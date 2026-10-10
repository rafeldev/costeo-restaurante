import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { TipoMovimientoValue, UnidadBaseValue } from "@/lib/domain";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { getDeltaFromMovimiento, getEstadoReposicion } from "@/lib/inventory-rules";
import { calculateUnitCostFromPurchase, convertQuantity } from "@/lib/unit-conversion";

type DecimalLike = { toNumber: () => number };
type InventarioClient = {
  inventarioInsumo: {
    upsert: typeof db.inventarioInsumo.upsert;
  };
};

type RecetaProduccion = {
  id: string;
  nombre: string;
  ingredientes: Array<{
    insumoId: string;
    cantidad: DecimalLike | number;
    insumo: {
      ownerId: string;
      nombre: string;
      costoUnidad: DecimalLike | number;
      mermaPct: DecimalLike | number;
    };
  }>;
};

type ProduccionConMovimientos = {
  id: string;
  recetaNombre: string;
  movimientos: Array<{
    insumoId: string;
    cantidad: DecimalLike | number;
  }>;
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

async function crearProduccionConConsumos(
  tx: Prisma.TransactionClient,
  payload: {
    ownerId: string;
    receta: RecetaProduccion;
    unidades: number;
    fecha: Date;
  },
) {
  if (payload.receta.ingredientes.length === 0) {
    throw new ValidationError("La receta no tiene ingredientes para producir");
  }
  if (payload.receta.ingredientes.some((item) => item.insumo.ownerId !== payload.ownerId)) {
    throw new ValidationError("Ingrediente fuera del alcance del usuario");
  }

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
      recetaId: payload.receta.id,
      recetaNombre: payload.receta.nombre,
      unidades: payload.unidades,
      costoTotalProduccion: 0,
      estado: "ACTIVA",
      fechaProduccion: payload.fecha,
    },
  });

  for (const item of payload.receta.ingredientes) {
    const cantidadBase = decimalToNumber(item.cantidad);
    const costoUnitario = decimalToNumber(item.insumo.costoUnidad);
    const mermaPct = decimalToNumber(item.insumo.mermaPct);
    const cantidadDescontada = cantidadBase * payload.unidades * (1 + mermaPct / 100);
    const costoAplicado = cantidadDescontada * costoUnitario;
    costoTotal += costoAplicado;

    await ensureInventarioInsumo(item.insumoId, tx);
    const updatedInventario = await tx.inventarioInsumo.update({
      where: { insumoId: item.insumoId },
      data: { stockActual: { decrement: cantidadDescontada } },
    });
    await tx.movimientoInventario.create({
      data: {
        insumoId: item.insumoId,
        tipo: "SALIDA",
        cantidad: cantidadDescontada,
        motivo: `Producción receta ${payload.receta.nombre} x${payload.unidades}`,
        fechaMovimiento: payload.fecha,
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

  return { produccion: updated, costoTotal, consumos };
}

async function revertirMovimientosProduccion(
  tx: Prisma.TransactionClient,
  produccion: ProduccionConMovimientos,
  motivo: string,
) {
  const anulada = await tx.produccion.updateMany({
    where: { id: produccion.id, estado: "ACTIVA" },
    data: { estado: "ANULADA" },
  });
  if (anulada.count === 0) {
    throw new ValidationError("Esta producción ya fue anulada");
  }

  for (const movimiento of produccion.movimientos) {
    const cantidadDevuelta = decimalToNumber(movimiento.cantidad);
    await ensureInventarioInsumo(movimiento.insumoId, tx);
    await tx.inventarioInsumo.update({
      where: { insumoId: movimiento.insumoId },
      data: { stockActual: { increment: cantidadDevuelta } },
    });
    await tx.movimientoInventario.create({
      data: {
        insumoId: movimiento.insumoId,
        tipo: "ENTRADA",
        cantidad: cantidadDevuelta,
        motivo,
        fechaMovimiento: new Date(),
        produccionId: produccion.id,
      },
    });
  }
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
      throw new NotFoundError("Insumo no encontrado");
    }

    if (payload.proveedorId) {
      const proveedor = await tx.proveedor.findFirst({
        where: { id: payload.proveedorId, ownerId: payload.ownerId },
        select: { id: true },
      });
      if (!proveedor) {
        throw new NotFoundError("Proveedor no encontrado para el usuario");
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
      throw new ValidationError("No fue posible calcular costo unitario para la compra");
    }

    const cantidadConvertida = convertQuantity(
      payload.cantidadCompra,
      payload.unidadCompra,
      unidadBase,
    );
    if (!cantidadConvertida) {
      throw new ValidationError(
        "La unidad de compra no es compatible con la unidad base del insumo",
      );
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

    await ensureInventarioInsumo(payload.insumoId, tx);
    const updatedInventario = await tx.inventarioInsumo.update({
      where: { insumoId: payload.insumoId },
      data: { stockActual: { increment: cantidadConvertida } },
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
      throw new NotFoundError("Insumo no encontrado");
    }

    await ensureInventarioInsumo(payload.insumoId, tx);
    const delta = getDeltaFromMovimiento(payload.tipo, payload.cantidad);

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
      data: { stockActual: { increment: delta } },
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
      throw new NotFoundError("Receta no encontrada");
    }
    const fechaMovimiento = payload.fechaProduccion ?? new Date();
    const result = await crearProduccionConConsumos(tx, {
      ownerId: payload.ownerId,
      receta,
      unidades: payload.unidades,
      fecha: fechaMovimiento,
    });

    return {
      produccionId: result.produccion.id,
      recetaId: receta.id,
      recetaNombre: receta.nombre,
      unidades: payload.unidades,
      costoTotalProduccion: result.costoTotal,
      fechaProduccion: fechaMovimiento,
      consumos: result.consumos,
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
      throw new NotFoundError("Producción no encontrada");
    }
    if (produccion.estado === "ANULADA") {
      throw new ValidationError("Esta producción ya fue anulada");
    }

    await revertirMovimientosProduccion(
      tx,
      produccion,
      `Anulación producción ${produccion.recetaNombre}`,
    );

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
      throw new NotFoundError("Producción no encontrada");
    }
    if (produccionOriginal.estado === "ANULADA") {
      throw new ValidationError("No se puede editar una producción anulada");
    }
    if (!produccionOriginal.recetaId) {
      throw new NotFoundError("La receta asociada ya no existe");
    }

    const receta = await tx.receta.findFirst({
      where: { id: produccionOriginal.recetaId, ownerId: payload.ownerId },
      include: {
        ingredientes: { include: { insumo: true }, orderBy: { createdAt: "asc" } },
      },
    });

    if (!receta) {
      throw new NotFoundError("La receta asociada ya no existe");
    }

    await revertirMovimientosProduccion(
      tx,
      produccionOriginal,
      `Corrección producción ${produccionOriginal.recetaNombre}`,
    );
    const result = await crearProduccionConConsumos(tx, {
      ownerId: payload.ownerId,
      receta,
      unidades: payload.nuevasUnidades,
      fecha: produccionOriginal.fechaProduccion,
    });

    return {
      produccionAnuladaId: produccionOriginal.id,
      nuevaProduccionId: result.produccion.id,
      unidades: payload.nuevasUnidades,
      costoTotalProduccion: result.costoTotal,
    };
  });
}
