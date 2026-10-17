import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import {
  calcularDiferencia,
  calcularVarianzaPct,
  getEstadoConteo,
  INVENTORY_CRITICAL_DEFAULT,
  INVENTORY_TOLERANCE_DEFAULT,
} from "@/lib/inventory-reconciliation";
import { getPaginationMetadata, normalizePagination } from "@/lib/pagination";
import { lockInventoryOwner } from "@/lib/inventory-lock";
import { toPlainNumber } from "@/lib/serializers";
import type { z } from "zod";
import type { conteoInsumoPatchSchema } from "@/lib/validation";

type ConteosPatch = z.output<typeof conteoInsumoPatchSchema>;

const conteoInclude = {
  insumo: {
    select: {
      id: true,
      sku: true,
      codigo: true,
      nombre: true,
      categoria: true,
      unidadBase: true,
      area: { select: { id: true, nombre: true, orden: true } },
    },
  },
} satisfies Prisma.ConteoInsumoInclude;

function currentPeriod(now = new Date()) {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

async function getThresholds(ownerId: string, client: Prisma.TransactionClient | typeof db = db) {
  const config = await client.configuracionCosteo.findUnique({
    where: { ownerId },
    select: { toleranciaInventarioPct: true, criticoInventarioPct: true },
  });
  return {
    toleranciaPct: config ? toPlainNumber(config.toleranciaInventarioPct) : INVENTORY_TOLERANCE_DEFAULT,
    criticoPct: config ? toPlainNumber(config.criticoInventarioPct) : INVENTORY_CRITICAL_DEFAULT,
  };
}

function serializeConteo(
  conteo: Prisma.ConteoInsumoGetPayload<{ include: typeof conteoInclude }>,
  thresholds: Awaited<ReturnType<typeof getThresholds>>,
) {
  const stockTeorico = toPlainNumber(conteo.stockTeorico);
  const stockFisico = conteo.stockFisico === null ? null : toPlainNumber(conteo.stockFisico);
  const costoUnitario = toPlainNumber(conteo.costoUnitario);
  const diferencia = calcularDiferencia(stockTeorico, stockFisico);
  const varianzaPct = calcularVarianzaPct(stockTeorico, stockFisico);
  return {
    id: conteo.id,
    insumoId: conteo.insumoId,
    sku: conteo.insumo.sku,
    codigo: conteo.insumo.codigo,
    nombre: conteo.insumo.nombre,
    categoria: conteo.insumo.categoria,
    unidadBase: conteo.insumo.unidadBase,
    area: conteo.insumo.area,
    stockTeorico,
    costoUnitario,
    stockFisico,
    diferencia,
    varianzaPct: varianzaPct !== null && Number.isFinite(varianzaPct) ? varianzaPct : null,
    impacto: diferencia === null ? null : Number((diferencia * costoUnitario).toFixed(2)),
    estado: getEstadoConteo(
      stockTeorico,
      stockFisico,
      thresholds.toleranciaPct,
      thresholds.criticoPct,
    ),
    motivo: conteo.motivo,
    nota: conteo.nota,
    contadoPor: conteo.contadoPor,
    contadoEn: conteo.contadoEn?.toISOString() ?? null,
  };
}

export async function listarTomasInventario(ownerId: string, searchParams: URLSearchParams) {
  const pagination = normalizePagination(searchParams, { defaultPageSize: 10 });
  const total = await db.tomaInventario.count({ where: { ownerId } });
  const metadata = getPaginationMetadata(total, pagination);
  const items = await db.tomaInventario.findMany({
    where: { ownerId },
    include: { _count: { select: { conteos: true } }, conteos: { select: { stockFisico: true } } },
    orderBy: { abiertaEn: "desc" },
    skip: (metadata.page - 1) * metadata.pageSize,
    take: metadata.pageSize,
  });
  return {
    items: items.map(({ _count, conteos, ...toma }) => ({
      ...toma,
      abiertaEn: toma.abiertaEn.toISOString(),
      cerradaEn: toma.cerradaEn?.toISOString() ?? null,
      total: _count.conteos,
      contados: conteos.filter((conteo) => conteo.stockFisico !== null).length,
    })),
    total: metadata.total,
    page: metadata.page,
    pageSize: metadata.pageSize,
  };
}

export async function abrirTomaInventario(
  ownerId: string,
  input: { periodo?: string; observaciones?: string | null },
) {
  return db.$transaction(async (tx) => {
    await lockInventoryOwner(tx, ownerId);
    const enCurso = await tx.tomaInventario.findFirst({
      where: { ownerId, estado: "EN_CURSO" },
      select: { id: true },
    });
    if (enCurso) throw new ConflictError("Ya existe una toma de inventario en curso");

    const insumos = await tx.insumo.findMany({
      where: { ownerId, activo: true },
      select: { id: true, costoUnidad: true, inventario: { select: { stockActual: true } } },
      orderBy: { nombre: "asc" },
    });
    return tx.tomaInventario.create({
      data: {
        ownerId,
        periodo: input.periodo ?? currentPeriod(),
        observaciones: input.observaciones || null,
        conteos: {
          create: insumos.map((insumo) => ({
            insumoId: insumo.id,
            stockTeorico: insumo.inventario?.stockActual ?? 0,
            costoUnitario: insumo.costoUnidad,
          })),
        },
      },
    });
  });
}

export async function obtenerTomaInventario(
  ownerId: string,
  id: string,
  searchParams = new URLSearchParams(),
) {
  const toma = await db.tomaInventario.findFirst({
    where: { id, ownerId },
    include: { conteos: { include: conteoInclude, orderBy: { insumo: { nombre: "asc" } } } },
  });
  if (!toma) throw new NotFoundError("Toma de inventario no encontrada");
  const thresholds = await getThresholds(ownerId);
  const allItems = toma.conteos.map((conteo) => serializeConteo(conteo, thresholds));
  const q = (searchParams.get("q") ?? "").trim().toLocaleLowerCase("es");
  const area = searchParams.get("area");
  const familia = searchParams.get("familia");
  const soloDiscrepancia = searchParams.get("soloDiscrepancia") === "true";
  const filtered = allItems.filter((item) => {
    if (area === "sin-area" ? item.area !== null : area && item.area?.id !== area) return false;
    if (familia && item.categoria !== familia) return false;
    if (q && !`${item.nombre} ${item.codigo} ${item.sku ?? ""}`.toLocaleLowerCase("es").includes(q)) return false;
    if (soloDiscrepancia && (item.diferencia === null || item.diferencia === 0)) return false;
    return true;
  });
  const pagination = normalizePagination(searchParams, { defaultPageSize: 20 });
  const metadata = getPaginationMetadata(filtered.length, pagination);
  const counted = allItems.filter((item) => item.stockFisico !== null);
  const impactos = counted.map((item) => item.impacto ?? 0);
  return {
    id: toma.id,
    periodo: toma.periodo,
    estado: toma.estado,
    observaciones: toma.observaciones,
    firmadoPor: toma.firmadoPor,
    abiertaEn: toma.abiertaEn.toISOString(),
    cerradaEn: toma.cerradaEn?.toISOString() ?? null,
    total: allItems.length,
    contados: counted.length,
    ...thresholds,
    kpis: {
      valorInventariado: Number(counted.reduce((sum, item) => sum + (item.stockFisico ?? 0) * item.costoUnitario, 0).toFixed(2)),
      varianzaGlobalNeta: Number(impactos.reduce((sum, value) => sum + value, 0).toFixed(2)),
      discrepanciasCriticas: allItems.filter((item) => item.estado === "CRITICO").length,
      progresoPct: allItems.length === 0 ? 100 : Number(((counted.length / allItems.length) * 100).toFixed(1)),
    },
    resumen: {
      faltantes: Number(impactos.filter((value) => value < 0).reduce((sum, value) => sum + value, 0).toFixed(2)),
      sobrantes: Number(impactos.filter((value) => value > 0).reduce((sum, value) => sum + value, 0).toFixed(2)),
      ajusteNeto: Number(impactos.reduce((sum, value) => sum + value, 0).toFixed(2)),
      pendientes: allItems.length - counted.length,
    },
    items: filtered.slice((metadata.page - 1) * metadata.pageSize, metadata.page * metadata.pageSize),
    totalFiltrado: metadata.total,
    page: metadata.page,
    pageSize: metadata.pageSize,
  };
}

export async function guardarConteosInventario(
  ownerId: string,
  tomaId: string,
  input: ConteosPatch,
  contadoPor: string,
) {
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "TomaInventario" WHERE "id" = ${tomaId} AND "ownerId" = ${ownerId} FOR UPDATE`;
    const toma = await tx.tomaInventario.findFirst({ where: { id: tomaId, ownerId } });
    if (!toma) throw new NotFoundError("Toma de inventario no encontrada");
    if (toma.estado !== "EN_CURSO") throw new ConflictError("La toma ya está cerrada");
    const ids = [...new Set(input.conteos.map((conteo) => conteo.id))];
    const owned = await tx.conteoInsumo.count({ where: { tomaId, id: { in: ids } } });
    if (owned !== ids.length) throw new NotFoundError("Uno o más conteos no pertenecen a la toma");
    const now = new Date();
    for (const conteo of input.conteos) {
      await tx.conteoInsumo.update({
        where: { id: conteo.id },
        data: {
          stockFisico: conteo.stockFisico,
          motivo: conteo.motivo ?? null,
          nota: conteo.nota ?? null,
          contadoPor: conteo.stockFisico === null ? null : contadoPor,
          contadoEn: conteo.stockFisico === null ? null : now,
        },
      });
    }
    if (input.observaciones !== undefined) {
      await tx.tomaInventario.update({
        where: { id: tomaId },
        data: { observaciones: input.observaciones || null },
      });
    }
  });
}

export async function cerrarTomaInventario(
  ownerId: string,
  tomaId: string,
  firmadoPor: string,
  forzar = false,
) {
  return db.$transaction(async (tx) => {
    await lockInventoryOwner(tx, ownerId);
    await tx.$queryRaw`SELECT "id" FROM "TomaInventario" WHERE "id" = ${tomaId} AND "ownerId" = ${ownerId} FOR UPDATE`;
    const toma = await tx.tomaInventario.findFirst({
      where: { id: tomaId, ownerId },
      include: { conteos: true },
    });
    if (!toma) throw new NotFoundError("Toma de inventario no encontrada");
    if (toma.estado === "CERRADA") return { tomaId, estado: "CERRADA" as const, yaCerrada: true };
    const thresholds = await getThresholds(ownerId, tx);
    const pendientes = toma.conteos.filter((conteo) => conteo.stockFisico === null);
    if (pendientes.length > 0 && !forzar) {
      throw new ValidationError(`Quedan ${pendientes.length} conteos pendientes`);
    }
    for (const conteo of toma.conteos) {
      if (conteo.stockFisico === null) continue;
      const teorico = toPlainNumber(conteo.stockTeorico);
      const fisico = toPlainNumber(conteo.stockFisico);
      const varianza = calcularVarianzaPct(teorico, fisico);
      if (varianza !== null && Math.abs(varianza) >= thresholds.criticoPct && !conteo.motivo) {
        throw new ValidationError("Toda discrepancia crítica debe tener un motivo");
      }
    }
    const cerradaEn = new Date();
    await tx.tomaInventario.update({
      where: { id: tomaId },
      data: { estado: "CERRADA", cerradaEn, firmadoPor },
    });
    for (const conteo of toma.conteos) {
      if (conteo.stockFisico === null) continue;
      const diferencia = calcularDiferencia(
        toPlainNumber(conteo.stockTeorico),
        toPlainNumber(conteo.stockFisico),
      )!;
      if (diferencia === 0) continue;
      await tx.inventarioInsumo.upsert({
        where: { insumoId: conteo.insumoId },
        create: { insumoId: conteo.insumoId, stockActual: diferencia, stockMinimo: 0 },
        update: { stockActual: { increment: diferencia } },
      });
      await tx.movimientoInventario.create({
        data: {
          insumoId: conteo.insumoId,
          tipo: "AJUSTE",
          cantidad: diferencia,
          motivo: `Toma de inventario ${toma.periodo}`,
          fechaMovimiento: cerradaEn,
        },
      });
    }

    return { tomaId, estado: "CERRADA" as const, yaCerrada: false };
  });
}
