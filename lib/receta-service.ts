import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { DomainError, NotFoundError } from "@/lib/errors";
import { getPaginationMetadata, type PaginationParams } from "@/lib/pagination";
import { calculateSuggestedPrice } from "@/lib/pricing/calculateSuggestedPrice";
import { getEstadoRentabilidad, type EstadoRentabilidad } from "@/lib/pricing/getEstadoRentabilidad";
import { createWithReadableCode, formatReadableCode } from "@/lib/readable-code";
import { decimalToNumber } from "@/lib/serializers";
import { applyWasteYield } from "@/lib/unit-conversion";
import type { recetaSchema } from "@/lib/validation";
import type { z } from "zod";

export const recetaInclude = {
  ingredientes: {
    include: {
      insumo: {
        select: {
          id: true,
          ownerId: true,
          codigo: true,
          nombre: true,
          categoria: true,
          unidadBase: true,
          costoUnidad: true,
          mermaPct: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  },
} satisfies Prisma.RecetaInclude;

type RecetaInput = z.output<typeof recetaSchema>;
type RecetaWithIngredients = Prisma.RecetaGetPayload<{ include: typeof recetaInclude }>;
type Config = {
  overheadPct: Prisma.Decimal;
  margenObjetivoPct: Prisma.Decimal;
  impuestoPct: Prisma.Decimal;
  redondeoPrecio: Prisma.Decimal;
  foodCostCriticoPct: Prisma.Decimal;
};

function round(value: number, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function serializeIngredient(item: RecetaWithIngredients["ingredientes"][number]) {
  return {
    id: item.id,
    recetaId: item.recetaId,
    insumoId: item.insumoId,
    cantidad: decimalToNumber(item.cantidad) ?? 0,
    insumo: {
      id: item.insumo.id,
      codigo: item.insumo.codigo,
      nombre: item.insumo.nombre,
      categoria: item.insumo.categoria,
      unidadBase: item.insumo.unidadBase,
      costoUnidad: decimalToNumber(item.insumo.costoUnidad) ?? 0,
      mermaPct: decimalToNumber(item.insumo.mermaPct) ?? 0,
    },
  };
}

export function serializeReceta(receta: RecetaWithIngredients) {
  return {
    id: receta.id,
    codigo: receta.codigo,
    nombre: receta.nombre,
    categoria: receta.categoria,
    rendimientoPorciones: receta.rendimientoPorciones,
    tiempoPreparacionMin: receta.tiempoPreparacionMin,
    precioVentaActual: decimalToNumber(receta.precioVentaActual),
    borrador: receta.borrador,
    activa: receta.activa,
    createdAt: receta.createdAt,
    updatedAt: receta.updatedAt,
    ingredientes: receta.ingredientes.map(serializeIngredient),
  };
}

export function costRecipe(receta: RecetaWithIngredients, config: Config) {
  const costoMateriaPrima = receta.ingredientes.reduce((total, item) => {
    const cantidad = decimalToNumber(item.cantidad) ?? 0;
    const costo = decimalToNumber(item.insumo.costoUnidad) ?? 0;
    const merma = decimalToNumber(item.insumo.mermaPct) ?? 0;
    return total + applyWasteYield(cantidad, merma) * costo;
  }, 0);
  const impuestoPct = decimalToNumber(config.impuestoPct) ?? 0;
  const pvpCarta = decimalToNumber(receta.precioVentaActual);
  const pricing = calculateSuggestedPrice({
    costoMateriaPrima,
    rendimientoPorciones: receta.rendimientoPorciones,
    overheadPct: decimalToNumber(config.overheadPct) ?? 0,
    margenObjetivoPct: decimalToNumber(config.margenObjetivoPct) ?? 0,
    impuestoPct,
    redondeoPrecio: decimalToNumber(config.redondeoPrecio) ?? 0,
    precioVentaActual: pvpCarta,
  });
  const ventaNeta = pvpCarta && pvpCarta > 0 ? pvpCarta / (1 + impuestoPct / 100) : null;
  const foodCostPct = ventaNeta ? (pricing.costoPorPorcion / ventaNeta) * 100 : null;
  const estado = getEstadoRentabilidad(foodCostPct, {
    foodCostCriticoPct: decimalToNumber(config.foodCostCriticoPct) ?? 35,
  });

  return {
    costoPorcion: round(pricing.costoPorPorcion, 4),
    pvpCarta,
    pvpSugerido: round(pricing.precioSugeridoFinal, 2),
    foodCostPct: foodCostPct === null ? null : round(foodCostPct),
    margenContribucionPct: pricing.margenRealPct === null ? null : round(pricing.margenRealPct),
    estado,
    nInsumos: receta.ingredientes.length,
  };
}

async function getConfig(ownerId: string) {
  const config = await db.configuracionCosteo.findFirst({
    where: { ownerId },
    orderBy: { createdAt: "asc" },
  });
  if (!config) throw new NotFoundError("Configuración de costeo no encontrada.");
  return config;
}

export async function getRecetasCatalogo(
  ownerId: string,
  pagination: PaginationParams,
  filters: {
    categoria?: RecetaInput["categoria"];
    estado?: "rentable" | "ajustar" | "riesgo";
    insumoId?: string;
  },
) {
  const where: Prisma.RecetaWhereInput = {
    ownerId,
    categoria: filters.categoria,
    ingredientes: filters.insumoId
      ? { some: { insumoId: filters.insumoId, insumo: { ownerId } } }
      : undefined,
    ...(pagination.q
      ? {
          OR: [
            { nombre: { contains: pagination.q, mode: "insensitive" } },
            { codigo: { contains: pagination.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const config = await getConfig(ownerId);
  const orderBy = [{ activa: "desc" }, { nombre: "asc" }] satisfies Prisma.RecetaOrderByWithRelationInput[];

  if (!filters.estado) {
    const total = await db.receta.count({ where });
    const metadata = getPaginationMetadata(total, pagination);
    const recetas = await db.receta.findMany({
      where,
      include: recetaInclude,
      orderBy,
      skip: (metadata.page - 1) * metadata.pageSize,
      take: metadata.pageSize,
    });
    return {
      items: recetas.map((receta) => ({ ...serializeReceta(receta), ...costRecipe(receta, config) })),
      total: metadata.total,
      page: metadata.page,
      pageSize: metadata.pageSize,
    };
  }

  const recetas = await db.receta.findMany({ where, include: recetaInclude, orderBy });
  const stateMap: Record<NonNullable<typeof filters.estado>, EstadoRentabilidad> = {
    rentable: "Rentable",
    ajustar: "Ajustar",
    riesgo: "Riesgo",
  };
  const costed = recetas
    .map((receta) => ({ ...serializeReceta(receta), ...costRecipe(receta, config) }))
    .filter((receta) => receta.estado === stateMap[filters.estado!]);
  const metadata = getPaginationMetadata(costed.length, pagination);
  const offset = (metadata.page - 1) * metadata.pageSize;
  return {
    items: costed.slice(offset, offset + metadata.pageSize),
    total: metadata.total,
    page: metadata.page,
    pageSize: metadata.pageSize,
  };
}

export async function getRecetasResumen(ownerId: string) {
  const [recetas, config] = await Promise.all([
    db.receta.findMany({ where: { ownerId }, include: recetaInclude }),
    getConfig(ownerId),
  ]);
  const costed = recetas.map((receta) => ({ receta, costeo: costRecipe(receta, config) }));
  const active = costed.filter(({ receta }) => receta.activa && !receta.borrador);
  const withPrice = active.filter(({ costeo }) => costeo.foodCostPct !== null);
  const average = (values: number[]) => values.length
    ? round(values.reduce((sum, value) => sum + value, 0) / values.length)
    : null;
  return {
    activas: active.length,
    foodCostPromedio: average(withPrice.map(({ costeo }) => costeo.foodCostPct!)),
    margenContribucionPromedio: average(
      withPrice.map(({ costeo }) => costeo.margenContribucionPct ?? 0),
    ),
    requierenRevision: active.filter(({ costeo }) =>
      costeo.estado === "Ajustar" || costeo.estado === "Riesgo"
    ).length,
  };
}

async function assertOwnedIngredients(
  tx: Prisma.TransactionClient,
  ownerId: string,
  ingredientes: RecetaInput["ingredientes"],
) {
  const ids = [...new Set(ingredientes.map((item) => item.insumoId))];
  if (ids.length !== ingredientes.length) throw new DomainError("No repitas insumos en la receta.");
  const count = await tx.insumo.count({ where: { ownerId, id: { in: ids }, activo: true } });
  if (count !== ids.length) throw new DomainError("Uno o más insumos no existen, están inactivos o no pertenecen al usuario.");
}

function recipeData(data: RecetaInput) {
  return {
    nombre: data.nombre,
    categoria: data.categoria,
    rendimientoPorciones: data.rendimientoPorciones,
    tiempoPreparacionMin: data.tiempoPreparacionMin ?? null,
    precioVentaActual: data.precioVentaActual ?? null,
    borrador: data.borrador,
    activa: data.activa,
  };
}

export async function createReceta(ownerId: string, data: RecetaInput) {
  return createWithReadableCode(() => db.$transaction(async (tx) => {
    await assertOwnedIngredients(tx, ownerId, data.ingredientes);
    const [counter] = await tx.$queryRaw<Array<{ max: bigint | null }>>`
      SELECT MAX(CAST(SUBSTRING("codigo" FROM '[0-9]+$') AS BIGINT)) AS max
      FROM "Receta"
      WHERE "ownerId" = ${ownerId}
    `;
    return tx.receta.create({
      data: {
        ownerId,
        codigo: formatReadableCode(Number(counter?.max ?? 0) + 1, "RC"),
        ...recipeData(data),
        ingredientes: { create: data.ingredientes },
      },
      include: recetaInclude,
    });
  }));
}

export async function updateReceta(ownerId: string, id: string, data: RecetaInput) {
  return db.$transaction(async (tx) => {
    const existing = await tx.receta.findFirst({ where: { id, ownerId }, select: { id: true } });
    if (!existing) throw new NotFoundError("Receta no encontrada.");
    await assertOwnedIngredients(tx, ownerId, data.ingredientes);
    await tx.recetaInsumo.deleteMany({ where: { recetaId: id } });
    return tx.receta.update({
      where: { id },
      data: { ...recipeData(data), ingredientes: { create: data.ingredientes } },
      include: recetaInclude,
    });
  });
}

export async function duplicateReceta(ownerId: string, id: string) {
  return createWithReadableCode(() => db.$transaction(async (tx) => {
    const source = await tx.receta.findFirst({ where: { id, ownerId }, include: recetaInclude });
    if (!source) throw new NotFoundError("Receta no encontrada.");
    const [counter] = await tx.$queryRaw<Array<{ max: bigint | null }>>`
      SELECT MAX(CAST(SUBSTRING("codigo" FROM '[0-9]+$') AS BIGINT)) AS max
      FROM "Receta"
      WHERE "ownerId" = ${ownerId}
    `;
    return tx.receta.create({
      data: {
        ownerId,
        codigo: formatReadableCode(Number(counter?.max ?? 0) + 1, "RC"),
        nombre: `${source.nombre} (copia)`.slice(0, 120),
        categoria: source.categoria,
        rendimientoPorciones: source.rendimientoPorciones,
        tiempoPreparacionMin: source.tiempoPreparacionMin,
        precioVentaActual: source.precioVentaActual,
        borrador: true,
        activa: source.activa,
        ingredientes: {
          create: source.ingredientes.map((item) => ({
            insumoId: item.insumoId,
            cantidad: item.cantidad,
          })),
        },
      },
      include: recetaInclude,
    });
  }));
}
