import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { DomainError, NotFoundError } from "@/lib/errors";
import { createWithReadableCode, formatReadableCode } from "@/lib/readable-code";
import type { insumoSchema } from "@/lib/validation";
import type { z } from "zod";

export const insumoInclude = {
  inventario: true,
  proveedorPreferido: { select: { id: true, codigo: true, nombre: true } },
  area: { select: { id: true, nombre: true, orden: true } },
  _count: { select: { recetaInsumos: true } },
} satisfies Prisma.InsumoInclude;

export type InsumoInput = z.output<typeof insumoSchema>;

async function assertSupplier(ownerId: string, proveedorId: string | null | undefined) {
  if (!proveedorId) return;
  const proveedor = await db.proveedor.findFirst({
    where: { id: proveedorId, ownerId, activo: true },
    select: { id: true },
  });
  if (!proveedor) throw new DomainError("Proveedor no encontrado o inactivo.");
}

export async function createInsumo(ownerId: string, data: InsumoInput) {
  await assertSupplier(ownerId, data.proveedorPreferidoId);
  return createWithReadableCode(() =>
    db.$transaction(async (tx) => {
      const [counter] = await tx.$queryRaw<Array<{ max: bigint | null }>>`
        SELECT MAX(CAST(SUBSTRING("codigo" FROM '[0-9]+$') AS BIGINT)) AS max
        FROM "Insumo"
        WHERE "ownerId" = ${ownerId}
      `;
      return tx.insumo.create({
        data: {
          ownerId,
          codigo: formatReadableCode(Number(counter?.max ?? 0) + 1, "INS"),
          nombre: data.nombre,
          categoria: data.categoria,
          unidadBase: data.unidadBase,
          costoUnidad: data.costoUnidad,
          mermaPct: data.mermaPct,
          presentacionCantidad: data.presentacionCantidad,
          presentacionUnidad: data.presentacionUnidad,
          precioPresentacion: data.precioPresentacion,
          proveedorPreferidoId: data.proveedorPreferidoId || null,
          activo: data.activo,
          inventario: { create: { stockActual: 0, stockMinimo: 0 } },
        },
        include: insumoInclude,
      });
    }),
  );
}

export async function updateInsumo(
  ownerId: string,
  id: string,
  data: Partial<InsumoInput>,
) {
  const existing = await db.insumo.findFirst({
    where: { id, ownerId },
    select: { id: true },
  });
  if (!existing) throw new NotFoundError("Insumo no encontrado.");
  await assertSupplier(ownerId, data.proveedorPreferidoId);

  return db.insumo.update({
    where: { id },
    data: {
      nombre: data.nombre,
      categoria: data.categoria,
      unidadBase: data.unidadBase,
      costoUnidad: data.costoUnidad,
      mermaPct: data.mermaPct,
      presentacionCantidad: data.presentacionCantidad,
      presentacionUnidad: data.presentacionUnidad,
      precioPresentacion: data.precioPresentacion,
      proveedorPreferidoId:
        data.proveedorPreferidoId === undefined ? undefined : data.proveedorPreferidoId || null,
      activo: data.activo,
    },
    include: insumoInclude,
  });
}
