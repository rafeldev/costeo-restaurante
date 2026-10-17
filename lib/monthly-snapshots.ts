import { db } from "@/lib/db";
import { costRecipe, recetaInclude } from "@/lib/receta-service";

function round(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function previousMonthlyPeriod(now = new Date()) {
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function captureMonthlyCostingSnapshot(ownerId: string, periodo: string) {
  const [config, recetas] = await Promise.all([
    db.configuracionCosteo.findUnique({ where: { ownerId } }),
    db.receta.findMany({ where: { ownerId, activa: true, borrador: false }, include: recetaInclude }),
  ]);
  if (!config) return { status: "skipped" as const, reason: "missing-config" as const };
  const costeos = recetas.map((receta) => costRecipe(receta, config));
  const conPrecio = costeos.filter(
    (costeo): costeo is typeof costeo & { foodCostPct: number; margenContribucionPct: number } =>
      costeo.foodCostPct !== null && costeo.margenContribucionPct !== null,
  );
  if (conPrecio.length === 0) return { status: "skipped" as const, reason: "missing-priced-recipes" as const };
  const average = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
  const snapshot = await db.snapshotCosteoMensual.upsert({
    where: { ownerId_periodo: { ownerId, periodo } },
    create: {
      ownerId,
      periodo,
      foodCostPct: round(average(conPrecio.map((item) => item.foodCostPct))),
      margenPct: round(average(conPrecio.map((item) => item.margenContribucionPct))),
      recetasActivas: recetas.length,
      recetasRiesgo: costeos.filter((item) => item.estado === "Riesgo").length,
    },
    update: {},
  });
  return { status: "captured" as const, snapshotId: snapshot.id };
}
