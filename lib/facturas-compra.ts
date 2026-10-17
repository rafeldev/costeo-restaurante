import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { registrarCompraInsumoEnTransaccion } from "@/lib/inventory";
import { getPaginationMetadata, normalizePagination } from "@/lib/pagination";
import { toPlainNumber } from "@/lib/serializers";
import type { z } from "zod";
import type { facturaCompraPatchSchema, facturaCompraSchema } from "@/lib/validation";
import { parseBusinessDate } from "@/lib/business-date";

type FacturaInput = z.output<typeof facturaCompraSchema>;
type FacturaPatchInput = z.output<typeof facturaCompraPatchSchema>;

export const facturaCompraInclude = {
  proveedor: { select: { id: true, codigo: true, nombre: true } },
  lineas: {
    include: { insumo: { select: { id: true, codigo: true, nombre: true, unidadBase: true } } },
    orderBy: { createdAt: "asc" },
  },
} satisfies Prisma.FacturaCompraInclude;

export function calcularTotalesFactura(lineas: FacturaInput["lineas"]) {
  const subtotal = lineas.reduce(
    (total, linea) => total + linea.cantidad * linea.precioUnitarioBruto,
    0,
  );
  const impuestos = lineas.reduce(
    (total, linea) =>
      total + linea.cantidad * linea.precioUnitarioBruto * (linea.tasaImpuestoPct / 100),
    0,
  );
  return {
    subtotal: Number(subtotal.toFixed(4)),
    impuestos: Number(impuestos.toFixed(4)),
    total: Number((subtotal + impuestos).toFixed(4)),
  };
}

export function calcularFechaVencimiento(fechaEmision: Date, condicion: FacturaInput["condicionPago"]) {
  if (condicion === "CONTADO") return null;
  const fecha = new Date(fechaEmision);
  fecha.setUTCDate(fecha.getUTCDate() + (condicion === "CREDITO_15" ? 15 : 30));
  return fecha;
}

function parseFecha(value: string) {
  return parseBusinessDate(value, "fecha de emisión");
}

async function validarRelaciones(
  tx: Prisma.TransactionClient,
  ownerId: string,
  proveedorId: string,
  insumoIds: string[],
) {
  const [proveedor, insumos] = await Promise.all([
    tx.proveedor.findFirst({ where: { id: proveedorId, ownerId, activo: true }, select: { id: true } }),
    tx.insumo.findMany({
      where: { id: { in: [...new Set(insumoIds)] }, ownerId, activo: true },
      select: { id: true },
    }),
  ]);
  if (!proveedor) throw new NotFoundError("Proveedor no encontrado para el usuario");
  if (insumos.length !== new Set(insumoIds).size) {
    throw new NotFoundError("Uno o más insumos no pertenecen al usuario");
  }
}

function facturaData(ownerId: string, input: FacturaInput | FacturaPatchInput) {
  const fechaEmision = parseFecha(input.fechaEmision);
  const totales = calcularTotalesFactura(input.lineas);
  return {
    ownerId,
    proveedorId: input.proveedorId,
    tipo: input.tipo,
    numero: input.numero,
    fechaEmision,
    condicionPago: input.condicionPago,
    fechaVencimiento: calcularFechaVencimiento(fechaEmision, input.condicionPago),
    actualizaCostos: input.actualizaCostos,
    ...totales,
  };
}

async function aplicarFacturaEnTransaccion(
  tx: Prisma.TransactionClient,
  ownerId: string,
  facturaId: string,
) {
  const factura = await tx.facturaCompra.findFirst({
    where: { id: facturaId, ownerId },
    include: { lineas: true },
  });
  if (!factura) throw new NotFoundError("Factura no encontrada");
  if (factura.estado === "APLICADA") return;

  const claimed = await tx.facturaCompra.updateMany({
    where: { id: facturaId, ownerId, estado: "BORRADOR" },
    data: { estado: "APLICADA" },
  });
  if (claimed.count === 0) return;

  for (const linea of factura.lineas) {
    const resultado = await registrarCompraInsumoEnTransaccion(tx, {
      ownerId,
      insumoId: linea.insumoId,
      proveedorId: factura.proveedorId,
      fechaCompra: factura.fechaEmision,
      cantidadCompra: toPlainNumber(linea.cantidad),
      unidadCompra: linea.unidad,
      precioTotal: Number(
        (toPlainNumber(linea.cantidad) * toPlainNumber(linea.precioUnitarioBruto)).toFixed(4),
      ),
      actualizaCosto: factura.actualizaCostos,
    });
    await tx.facturaCompraLinea.update({
      where: { id: linea.id },
      data: { compraInsumoId: resultado.compra.id },
    });
  }
}

export async function crearFacturaCompra(ownerId: string, input: FacturaInput) {
  const id = await db.$transaction(async (tx) => {
    await validarRelaciones(tx, ownerId, input.proveedorId, input.lineas.map((linea) => linea.insumoId));
    const factura = await tx.facturaCompra.create({
      data: {
        ...facturaData(ownerId, input),
        lineas: {
          create: input.lineas.map((linea) => ({
            ownerId,
            ...linea,
            totalLinea: Number(
              (linea.cantidad * linea.precioUnitarioBruto * (1 + linea.tasaImpuestoPct / 100)).toFixed(4),
            ),
          })),
        },
      },
      select: { id: true },
    });
    if (input.aplicar) await aplicarFacturaEnTransaccion(tx, ownerId, factura.id);
    return factura.id;
  });
  return obtenerFacturaCompra(ownerId, id);
}

export async function obtenerFacturaCompra(ownerId: string, id: string) {
  const factura = await db.facturaCompra.findFirst({
    where: { id, ownerId },
    include: facturaCompraInclude,
  });
  if (!factura) throw new NotFoundError("Factura no encontrada");
  return factura;
}

export async function listarFacturasCompra(ownerId: string, searchParams: URLSearchParams) {
  const pagination = normalizePagination(searchParams, { defaultPageSize: 10 });
  const desde = searchParams.get("desde");
  const hasta = searchParams.get("hasta");
  const proveedorId = searchParams.get("proveedorId") || undefined;
  const where: Prisma.FacturaCompraWhereInput = {
    ownerId,
    proveedorId,
    fechaEmision: {
      gte: desde ? parseFecha(desde) : undefined,
      lte: hasta ? parseFecha(`${hasta}T23:59:59.999Z`) : undefined,
    },
    ...(pagination.q
      ? {
          OR: [
            { numero: { contains: pagination.q, mode: "insensitive" } },
            { proveedor: { nombre: { contains: pagination.q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
  const total = await db.facturaCompra.count({ where });
  const metadata = getPaginationMetadata(total, pagination);
  const items = await db.facturaCompra.findMany({
    where,
    include: facturaCompraInclude,
    orderBy: [{ fechaEmision: "desc" }, { createdAt: "desc" }],
    skip: (metadata.page - 1) * metadata.pageSize,
    take: metadata.pageSize,
  });
  return { items, total: metadata.total, page: metadata.page, pageSize: metadata.pageSize };
}

export async function actualizarFacturaCompra(ownerId: string, id: string, input: FacturaPatchInput) {
  await db.$transaction(async (tx) => {
    const factura = await tx.facturaCompra.findFirst({ where: { id, ownerId }, select: { estado: true } });
    if (!factura) throw new NotFoundError("Factura no encontrada");
    if (factura.estado !== "BORRADOR") throw new ValidationError("Solo se pueden editar facturas en borrador");
    await validarRelaciones(tx, ownerId, input.proveedorId, input.lineas.map((linea) => linea.insumoId));
    await tx.facturaCompraLinea.deleteMany({ where: { facturaId: id, ownerId } });
    await tx.facturaCompra.update({
      where: { id },
      data: {
        ...facturaData(ownerId, input),
        lineas: {
          create: input.lineas.map((linea) => ({
            ownerId,
            ...linea,
            totalLinea: Number(
              (linea.cantidad * linea.precioUnitarioBruto * (1 + linea.tasaImpuestoPct / 100)).toFixed(4),
            ),
          })),
        },
      },
    });
  });
  return obtenerFacturaCompra(ownerId, id);
}

export async function eliminarFacturaCompra(ownerId: string, id: string) {
  const deleted = await db.facturaCompra.deleteMany({ where: { id, ownerId, estado: "BORRADOR" } });
  if (deleted.count === 0) {
    const exists = await db.facturaCompra.findFirst({ where: { id, ownerId }, select: { estado: true } });
    if (!exists) throw new NotFoundError("Factura no encontrada");
    throw new ValidationError("Solo se pueden eliminar facturas en borrador");
  }
}

export async function aplicarFacturaCompra(ownerId: string, id: string) {
  await db.$transaction((tx) => aplicarFacturaEnTransaccion(tx, ownerId, id));
  return obtenerFacturaCompra(ownerId, id);
}

export function serializeFacturaCompra<T extends Record<string, unknown>>(factura: T) {
  const lineas = (factura.lineas as Array<Record<string, unknown>> | undefined)?.map((linea) => ({
    ...linea,
    cantidad: toPlainNumber(linea.cantidad),
    precioUnitarioBruto: toPlainNumber(linea.precioUnitarioBruto),
    tasaImpuestoPct: toPlainNumber(linea.tasaImpuestoPct),
    totalLinea: toPlainNumber(linea.totalLinea),
  }));
  return {
    ...factura,
    subtotal: toPlainNumber(factura.subtotal),
    impuestos: toPlainNumber(factura.impuestos),
    total: toPlainNumber(factura.total),
    ...(lineas ? { lineas } : {}),
  };
}
