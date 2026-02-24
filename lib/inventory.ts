import { db } from "@/lib/db";
import type { TipoMovimientoValue, UnidadBaseValue } from "@/lib/domain";
import { getDeltaFromMovimiento, getEstadoReposicion } from "@/lib/inventory-rules";
import { calculateUnitCostFromPurchase, convertQuantity } from "@/lib/unit-conversion";

type DecimalLike = { toNumber: () => number };
type InventarioClient = {
  inventarioInsumo: {
    upsert: typeof db.inventarioInsumo.upsert;
  };
};

function decimalToNumber(value: DecimalLike | number): number {
  if (typeof value === "number") return value;
  return value.toNumber();
}

async function ensureInventarioInsumo(
  insumoId: string,
  tx: InventarioClient = db,
) {
  return tx.inventarioInsumo.upsert({
    where: { insumoId },
    create: { insumoId, stockActual: 0, stockMinimo: 0 },
    update: {},
  });
}

export async function registrarCompraInsumo(payload: {
  ownerId: string;
  insumoId: string;
  proveedorId?: string | null;
  fechaCompra?: Date;
  cantidadCompra: number;
  unidadCompra: UnidadBaseValue;
  precioTotal: number;
}) {
  return db.$transaction(async (tx) => {
    const insumo = await tx.insumo.findFirst({
      where: { id: payload.insumoId, ownerId: payload.ownerId },
    });
    if (!insumo) {
      throw new Error("Insumo no encontrado");
    }

    if (payload.proveedorId) {
      const proveedor = await tx.proveedor.findFirst({
        where: { id: payload.proveedorId, ownerId: payload.ownerId },
        select: { id: true },
      });
      if (!proveedor) {
        throw new Error("Proveedor no encontrado para el usuario");
      }
    }

    const unidadBase = insumo.unidadBase as UnidadBaseValue;
    const costoUnitarioCalculado = calculateUnitCostFromPurchase({
      precioCompra: payload.precioTotal,
      cantidadCompra: payload.cantidadCompra,
      unidadCompra: payload.unidadCompra,
      unidadBase,
    });

    if (!costoUnitarioCalculado) {
      throw new Error("No fue posible calcular costo unitario para la compra");
    }

    const cantidadConvertida = convertQuantity(
      payload.cantidadCompra,
      payload.unidadCompra,
      unidadBase,
    );
    if (!cantidadConvertida) {
      throw new Error("La unidad de compra no es compatible con la unidad base del insumo");
    }

    const compra = await tx.compraInsumo.create({
      data: {
        insumoId: payload.insumoId,
        proveedorId: payload.proveedorId ?? null,
        fechaCompra: payload.fechaCompra ?? new Date(),
        cantidadCompra: payload.cantidadCompra,
        unidadCompra: payload.unidadCompra,
        precioTotal: payload.precioTotal,
        costoUnitarioCalculado,
      },
    });

    await tx.insumo.update({
      where: { id: payload.insumoId },
      data: {
        costoUnidad: costoUnitarioCalculado,
      },
    });

    const inventario = await ensureInventarioInsumo(payload.insumoId, tx);
    const stockActual = decimalToNumber(inventario.stockActual) + cantidadConvertida;
    const updatedInventario = await tx.inventarioInsumo.update({
      where: { insumoId: payload.insumoId },
      data: { stockActual },
    });

    await tx.movimientoInventario.create({
      data: {
        insumoId: payload.insumoId,
        tipo: "ENTRADA",
        cantidad: cantidadConvertida,
        motivo: "Entrada por compra",
        referenciaCompraId: compra.id,
        fechaMovimiento: payload.fechaCompra ?? new Date(),
      },
    });

    return {
      compra,
      inventario: {
        stockActual: decimalToNumber(updatedInventario.stockActual),
        stockMinimo: decimalToNumber(updatedInventario.stockMinimo),
      },
    };
  });
}

export async function registrarMovimientoInventario(payload: {
  ownerId: string;
  insumoId: string;
  tipo: TipoMovimientoValue;
  cantidad: number;
  motivo?: string;
  fechaMovimiento?: Date;
}) {
  return db.$transaction(async (tx) => {
    const insumo = await tx.insumo.findFirst({
      where: { id: payload.insumoId, ownerId: payload.ownerId },
    });
    if (!insumo) {
      throw new Error("Insumo no encontrado");
    }

    const inventario = await ensureInventarioInsumo(payload.insumoId, tx);
    const delta = getDeltaFromMovimiento(payload.tipo, payload.cantidad);
    const nextStock = decimalToNumber(inventario.stockActual) + delta;

    await tx.movimientoInventario.create({
      data: {
        insumoId: payload.insumoId,
        tipo: payload.tipo,
        cantidad: payload.cantidad,
        motivo: payload.motivo,
        fechaMovimiento: payload.fechaMovimiento ?? new Date(),
      },
    });

    const updatedInventario = await tx.inventarioInsumo.update({
      where: { insumoId: payload.insumoId },
      data: { stockActual: nextStock },
    });

    return {
      stockActual: decimalToNumber(updatedInventario.stockActual),
      stockMinimo: decimalToNumber(updatedInventario.stockMinimo),
      estado: getEstadoReposicion(
        decimalToNumber(updatedInventario.stockActual),
        decimalToNumber(updatedInventario.stockMinimo),
      ),
    };
  });
}

export async function registrarProduccionReceta(payload: {
  ownerId: string;
  recetaId: string;
  unidades: number;
  fechaProduccion?: Date;
}) {
  return db.$transaction(async (tx) => {
    const receta = await tx.receta.findFirst({
      where: { id: payload.recetaId, ownerId: payload.ownerId },
      include: {
        ingredientes: {
          include: { insumo: true },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!receta) {
      throw new Error("Receta no encontrada");
    }
    if (receta.ingredientes.length === 0) {
      throw new Error("La receta no tiene ingredientes para producir");
    }

    const fechaMovimiento = payload.fechaProduccion ?? new Date();
    let costoTotal = 0;
    const consumos: Array<{
      insumoId: string;
      nombre: string;
      cantidadDescontada: number;
      costoAplicado: number;
      stockActual: number;
      stockMinimo: number;
    }> = [];

    const produccion = await tx.produccion.create({
      data: {
        ownerId: payload.ownerId,
        recetaId: receta.id,
        recetaNombre: receta.nombre,
        unidades: payload.unidades,
        costoTotalProduccion: 0,
        estado: "ACTIVA",
        fechaProduccion: fechaMovimiento,
      },
    });

    for (const item of receta.ingredientes) {
      if (item.insumo.ownerId !== payload.ownerId) {
        throw new Error("Ingrediente fuera del alcance del usuario");
      }

      const cantidadBase = decimalToNumber(item.cantidad);
      const costoUnitario = decimalToNumber(item.insumo.costoUnidad);
      const mermaPct = decimalToNumber(item.insumo.mermaPct);
      const factorMerma = 1 + mermaPct / 100;
      const cantidadDescontada = cantidadBase * payload.unidades * factorMerma;
      const costoAplicado = cantidadDescontada * costoUnitario;
      costoTotal += costoAplicado;

      const inventario = await ensureInventarioInsumo(item.insumoId, tx);
      const nextStock = decimalToNumber(inventario.stockActual) - cantidadDescontada;
      const updatedInventario = await tx.inventarioInsumo.update({
        where: { insumoId: item.insumoId },
        data: { stockActual: nextStock },
      });

      await tx.movimientoInventario.create({
        data: {
          insumoId: item.insumoId,
          tipo: "SALIDA",
          cantidad: cantidadDescontada,
          motivo: `Producción receta ${receta.nombre} x${payload.unidades}`,
          fechaMovimiento,
          produccionId: produccion.id,
        },
      });

      consumos.push({
        insumoId: item.insumoId,
        nombre: item.insumo.nombre,
        cantidadDescontada,
        costoAplicado,
        stockActual: decimalToNumber(updatedInventario.stockActual),
        stockMinimo: decimalToNumber(updatedInventario.stockMinimo),
      });
    }

    const updated = await tx.produccion.update({
      where: { id: produccion.id },
      data: { costoTotalProduccion: costoTotal },
    });

    return {
      produccionId: updated.id,
      recetaId: receta.id,
      recetaNombre: receta.nombre,
      unidades: payload.unidades,
      costoTotalProduccion: costoTotal,
      fechaProduccion: fechaMovimiento,
      consumos,
    };
  });
}

export async function anularProduccion(payload: {
  ownerId: string;
  produccionId: string;
}) {
  return db.$transaction(async (tx) => {
    const produccion = await tx.produccion.findFirst({
      where: { id: payload.produccionId, ownerId: payload.ownerId },
      include: { movimientos: true },
    });

    if (!produccion) {
      throw new Error("Producción no encontrada");
    }
    if (produccion.estado === "ANULADA") {
      throw new Error("Esta producción ya fue anulada");
    }

    await tx.produccion.update({
      where: { id: produccion.id },
      data: { estado: "ANULADA" },
    });

    for (const mov of produccion.movimientos) {
      const cantidadDevuelta = decimalToNumber(mov.cantidad);
      const inventario = await ensureInventarioInsumo(mov.insumoId, tx);
      const nextStock = decimalToNumber(inventario.stockActual) + cantidadDevuelta;

      await tx.inventarioInsumo.update({
        where: { insumoId: mov.insumoId },
        data: { stockActual: nextStock },
      });

      await tx.movimientoInventario.create({
        data: {
          insumoId: mov.insumoId,
          tipo: "ENTRADA",
          cantidad: cantidadDevuelta,
          motivo: `Anulación producción ${produccion.recetaNombre}`,
          fechaMovimiento: new Date(),
          produccionId: produccion.id,
        },
      });
    }

    return { produccionId: produccion.id, estado: "ANULADA" as const };
  });
}

export async function editarProduccion(payload: {
  ownerId: string;
  produccionId: string;
  nuevasUnidades: number;
}) {
  return db.$transaction(async (tx) => {
    const produccionOriginal = await tx.produccion.findFirst({
      where: { id: payload.produccionId, ownerId: payload.ownerId },
      include: { movimientos: true },
    });

    if (!produccionOriginal) {
      throw new Error("Producción no encontrada");
    }
    if (produccionOriginal.estado === "ANULADA") {
      throw new Error("No se puede editar una producción anulada");
    }
    if (!produccionOriginal.recetaId) {
      throw new Error("La receta asociada ya no existe");
    }

    await tx.produccion.update({
      where: { id: produccionOriginal.id },
      data: { estado: "ANULADA" },
    });

    for (const mov of produccionOriginal.movimientos) {
      const cantidadDevuelta = decimalToNumber(mov.cantidad);
      const inventario = await ensureInventarioInsumo(mov.insumoId, tx);
      const nextStock = decimalToNumber(inventario.stockActual) + cantidadDevuelta;

      await tx.inventarioInsumo.update({
        where: { insumoId: mov.insumoId },
        data: { stockActual: nextStock },
      });

      await tx.movimientoInventario.create({
        data: {
          insumoId: mov.insumoId,
          tipo: "ENTRADA",
          cantidad: cantidadDevuelta,
          motivo: `Corrección producción ${produccionOriginal.recetaNombre}`,
          fechaMovimiento: new Date(),
          produccionId: produccionOriginal.id,
        },
      });
    }

    // Re-register with the corrected units but the original date
    const receta = await tx.receta.findFirst({
      where: { id: produccionOriginal.recetaId, ownerId: payload.ownerId },
      include: {
        ingredientes: { include: { insumo: true }, orderBy: { createdAt: "asc" } },
      },
    });

    if (!receta) {
      throw new Error("La receta asociada ya no existe");
    }

    let costoTotal = 0;
    const nuevaProduccion = await tx.produccion.create({
      data: {
        ownerId: payload.ownerId,
        recetaId: receta.id,
        recetaNombre: receta.nombre,
        unidades: payload.nuevasUnidades,
        costoTotalProduccion: 0,
        estado: "ACTIVA",
        fechaProduccion: produccionOriginal.fechaProduccion,
      },
    });

    for (const item of receta.ingredientes) {
      const cantidadBase = decimalToNumber(item.cantidad);
      const costoUnitario = decimalToNumber(item.insumo.costoUnidad);
      const mermaPct = decimalToNumber(item.insumo.mermaPct);
      const factorMerma = 1 + mermaPct / 100;
      const cantidadDescontada = cantidadBase * payload.nuevasUnidades * factorMerma;
      costoTotal += cantidadDescontada * costoUnitario;

      const inventario = await ensureInventarioInsumo(item.insumoId, tx);
      const nextStock = decimalToNumber(inventario.stockActual) - cantidadDescontada;

      await tx.inventarioInsumo.update({
        where: { insumoId: item.insumoId },
        data: { stockActual: nextStock },
      });

      await tx.movimientoInventario.create({
        data: {
          insumoId: item.insumoId,
          tipo: "SALIDA",
          cantidad: cantidadDescontada,
          motivo: `Producción receta ${receta.nombre} x${payload.nuevasUnidades}`,
          fechaMovimiento: produccionOriginal.fechaProduccion,
          produccionId: nuevaProduccion.id,
        },
      });
    }

    await tx.produccion.update({
      where: { id: nuevaProduccion.id },
      data: { costoTotalProduccion: costoTotal },
    });

    return {
      produccionAnuladaId: produccionOriginal.id,
      nuevaProduccionId: nuevaProduccion.id,
      unidades: payload.nuevasUnidades,
      costoTotalProduccion: costoTotal,
    };
  });
}
