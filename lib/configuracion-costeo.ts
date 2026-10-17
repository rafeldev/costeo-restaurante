import type { ConfiguracionCosteo, Prisma, RegimenTributario } from "@prisma/client";
import { db } from "@/lib/db";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { calculateRecipeCosting } from "@/lib/pricing/calculateRecipeCosting";
import { calculateSuggestedPrice } from "@/lib/pricing/calculateSuggestedPrice";
import { decimalToNumber } from "@/lib/serializers";
import { configuracionCosteoSchema } from "@/lib/validation";
import type { z } from "zod";

export const CONFIGURACION_COSTEO_DEFAULTS = {
  overheadPct: 12,
  margenObjetivoPct: 56.2,
  regimenTributario: "IMPOCONSUMO_8",
  impuestoPct: 8,
  redondeoPrecio: 100,
  foodCostCriticoPct: 35,
  margenMinimoPct: 40,
  alertaVolatilidadActiva: true,
  umbralVolatilidadPct: 15,
  toleranciaInventarioPct: 2,
  criticoInventarioPct: 5,
} as const satisfies Omit<Prisma.ConfiguracionCosteoUncheckedCreateInput, "id" | "ownerId" | "createdAt" | "updatedAt">;

export const IMPUESTO_POR_REGIMEN: Record<RegimenTributario, number> = {
  IMPOCONSUMO_8: 8,
  IVA_19: 19,
  EXENTO: 0,
};

type ConfigValues = z.output<typeof configuracionCosteoSchema>;
type ConfigPatch = Partial<ConfigValues>;

const AUDITABLE_FIELDS = [
  "overheadPct",
  "margenObjetivoPct",
  "regimenTributario",
  "impuestoPct",
  "redondeoPrecio",
  "foodCostCriticoPct",
  "margenMinimoPct",
  "alertaVolatilidadActiva",
  "umbralVolatilidadPct",
  "toleranciaInventarioPct",
  "criticoInventarioPct",
] as const;

export function serializeConfiguracion(config: ConfiguracionCosteo) {
  return {
    id: config.id,
    overheadPct: decimalToNumber(config.overheadPct) ?? 0,
    margenObjetivoPct: decimalToNumber(config.margenObjetivoPct) ?? 0,
    regimenTributario: config.regimenTributario,
    impuestoPct: decimalToNumber(config.impuestoPct) ?? 0,
    redondeoPrecio: decimalToNumber(config.redondeoPrecio) ?? 0,
    foodCostCriticoPct: decimalToNumber(config.foodCostCriticoPct) ?? 0,
    margenMinimoPct: decimalToNumber(config.margenMinimoPct) ?? 0,
    alertaVolatilidadActiva: config.alertaVolatilidadActiva,
    umbralVolatilidadPct: decimalToNumber(config.umbralVolatilidadPct) ?? 0,
    toleranciaInventarioPct: decimalToNumber(config.toleranciaInventarioPct) ?? 0,
    criticoInventarioPct: decimalToNumber(config.criticoInventarioPct) ?? 0,
    createdAt: config.createdAt,
    updatedAt: config.updatedAt,
  };
}

export async function ensureConfiguracionCosteo(ownerId: string) {
  return db.configuracionCosteo.upsert({
    where: { ownerId },
    update: {},
    create: { ownerId, ...CONFIGURACION_COSTEO_DEFAULTS },
  });
}

function toComparable(value: unknown) {
  if (typeof value === "boolean" || typeof value === "string") return String(value);
  return String(decimalToNumber(value as Parameters<typeof decimalToNumber>[0]) ?? value);
}

export async function actualizarConfiguracionCosteo(
  ownerId: string,
  usuarioId: string,
  patch: ConfigPatch,
) {
  return db.$transaction(async (tx) => {
    const existing = await tx.configuracionCosteo.upsert({
      where: { ownerId },
      update: {},
      create: { ownerId, ...CONFIGURACION_COSTEO_DEFAULTS },
    });
    const current = serializeConfiguracion(existing);
    const merged = configuracionCosteoSchema.safeParse({ ...current, ...patch });
    if (!merged.success) {
      throw new ValidationError(merged.error.issues[0]?.message ?? "Configuración inválida");
    }
    const data = {
      ...merged.data,
      impuestoPct: IMPUESTO_POR_REGIMEN[merged.data.regimenTributario],
    };
    const changes = AUDITABLE_FIELDS.flatMap((campo) => {
      const previous = toComparable(existing[campo]);
      const next = toComparable(data[campo]);
      return previous === next ? [] : [{ ownerId, usuarioId, campo, valorAnterior: previous, valorNuevo: next }];
    });

    const updated = changes.length
      ? await tx.configuracionCosteo.update({ where: { id: existing.id }, data })
      : existing;
    if (changes.length) await tx.configuracionCosteoAuditoria.createMany({ data: changes });
    return updated;
  });
}

export function restaurarConfiguracionCosteo(ownerId: string, usuarioId: string) {
  return actualizarConfiguracionCosteo(ownerId, usuarioId, CONFIGURACION_COSTEO_DEFAULTS);
}

export async function obtenerAuditoriaConfiguracion(ownerId: string, limit: number) {
  const items = await db.configuracionCosteoAuditoria.findMany({
    where: { ownerId },
    include: { usuario: { select: { id: true, email: true } } },
    orderBy: [{ creadoEn: "desc" }, { id: "desc" }],
    take: limit,
  });
  return {
    items: items.map((item) => ({
      id: item.id,
      campo: item.campo,
      valorAnterior: item.valorAnterior,
      valorNuevo: item.valorNuevo,
      creadoEn: item.creadoEn,
      usuario: item.usuario,
    })),
    limit,
  };
}

export async function obtenerSimulacionCosteo(ownerId: string, recetaId: string) {
  const config = await ensureConfiguracionCosteo(ownerId);
  const [receta, costeo] = await Promise.all([
    db.receta.findFirst({ where: { id: recetaId, ownerId }, select: { id: true, nombre: true, rendimientoPorciones: true, precioVentaActual: true } }),
    calculateRecipeCosting(recetaId, ownerId),
  ]);
  if (!receta) throw new NotFoundError("Receta no encontrada.");
  const pricing = calculateSuggestedPrice({
    costoMateriaPrima: costeo.costoMateriaPrima,
    rendimientoPorciones: receta.rendimientoPorciones,
    overheadPct: decimalToNumber(config.overheadPct) ?? 0,
    margenObjetivoPct: decimalToNumber(config.margenObjetivoPct) ?? 0,
    impuestoPct: decimalToNumber(config.impuestoPct) ?? 0,
    redondeoPrecio: decimalToNumber(config.redondeoPrecio) ?? 0,
    precioVentaActual: decimalToNumber(receta.precioVentaActual),
  });
  return {
    receta: { id: receta.id, nombre: receta.nombre, rendimientoPorciones: receta.rendimientoPorciones },
    costoMateriaPrima: costeo.costoMateriaPrima,
    costoPorPorcion: pricing.costoPorPorcion,
    precioSugeridoSinImpuesto: pricing.precioSugeridoSinImpuesto,
    impuestoPct: decimalToNumber(config.impuestoPct) ?? 0,
    precioSugeridoFinal: pricing.precioSugeridoFinal,
  };
}
