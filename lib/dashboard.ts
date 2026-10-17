import { db } from "@/lib/db";
import { getEstadoReposicion } from "@/lib/inventory-rules";
import { calculateRecipeCosting } from "@/lib/pricing/calculateRecipeCosting";
import { getEstadoRentabilidad } from "@/lib/pricing/getEstadoRentabilidad";
import { decimalToNumber } from "@/lib/serializers";

const FOOD_COST_MIN_PCT = 28;
const FOOD_COST_MAX_PCT = 35;

function round(value: number, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function previousPeriod(now: Date) {
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function getDashboard(ownerId: string, now = new Date()) {
  const [recetas, insumos, config] = await Promise.all([
    db.receta.findMany({
      where: { ownerId, activa: true, borrador: false },
      select: { id: true, nombre: true, precioVentaActual: true },
      orderBy: { nombre: "asc" },
    }),
    db.insumo.findMany({
      where: { ownerId },
      select: {
        mermaPct: true,
        inventario: { select: { stockActual: true, stockMinimo: true } },
      },
    }),
    db.configuracionCosteo.findFirst({ where: { ownerId }, orderBy: { createdAt: "asc" } }),
  ]);

  const costeos = await Promise.all(
    recetas.map(async (receta) => ({ receta, costeo: await calculateRecipeCosting(receta.id, ownerId) })),
  );
  const semaforo = costeos.map(({ receta, costeo }) => {
    const pvp = decimalToNumber(receta.precioVentaActual);
    const impuestoPct = decimalToNumber(config?.impuestoPct ?? null) ?? 8;
    const ventaNeta = pvp && pvp > 0 ? pvp / (1 + impuestoPct / 100) : null;
    const foodCostPct = ventaNeta ? (costeo.costoPorPorcion / ventaNeta) * 100 : null;
    const estado = getEstadoRentabilidad(foodCostPct, {
      foodCostObjetivoMinPct: FOOD_COST_MIN_PCT,
      foodCostObjetivoMaxPct: FOOD_COST_MAX_PCT,
      foodCostCriticoPct: decimalToNumber(config?.foodCostCriticoPct ?? null) ?? 35,
    });
    return {
      recetaId: receta.id,
      nombre: receta.nombre,
      estado,
      margenPct: costeo.margenRealPct === null ? null : round(costeo.margenRealPct),
      pvp,
      costo: round(costeo.costoPorPorcion, 4),
      foodCostPct: foodCostPct === null ? null : round(foodCostPct),
    };
  });

  const conPrecio = semaforo.filter((item) => item.foodCostPct !== null);
  const foodCostPromedio = conPrecio.length
    ? conPrecio.reduce((sum, item) => sum + (item.foodCostPct ?? 0), 0) / conPrecio.length
    : 0;
  const margenPromedio = conPrecio.length
    ? conPrecio.reduce((sum, item) => sum + (item.margenPct ?? 0), 0) / conPrecio.length
    : 0;
  const recetasRiesgo = semaforo.filter((item) => item.estado === "Riesgo").length;
  const recetasAjustar = semaforo.filter((item) => item.estado === "Ajustar").length;
  const periodoAnterior = previousPeriod(now);
  const snapshot = await db.snapshotCosteoMensual.findUnique({
    where: { ownerId_periodo: { ownerId, periodo: periodoAnterior } },
  });
  const alertas = insumos.map((insumo) => {
    const actual = decimalToNumber(insumo.inventario?.stockActual ?? null) ?? 0;
    const minimo = decimalToNumber(insumo.inventario?.stockMinimo ?? null) ?? 0;
    return getEstadoReposicion(actual, minimo);
  });
  const margenObjetivo = decimalToNumber(config?.margenObjetivoPct ?? null) ?? 56.2;

  return {
    foodCost: {
      valor: conPrecio.length ? round(foodCostPromedio) : null,
      deltaMensual: conPrecio.length && snapshot && snapshot.recetasActivas > 0
        ? round(foodCostPromedio - (decimalToNumber(snapshot.foodCostPct) ?? 0))
        : null,
      rango: `${FOOD_COST_MIN_PCT}-${FOOD_COST_MAX_PCT}%`,
    },
    margen: {
      valor: conPrecio.length ? round(margenPromedio) : null,
      deltaVsObjetivo: conPrecio.length ? round(margenPromedio - margenObjetivo) : null,
    },
    recetas: { activas: recetas.length, enRiesgo: recetasRiesgo, aRevisar: recetasAjustar },
    insumos: {
      total: insumos.length,
      conMerma: insumos.filter((item) => (decimalToNumber(item.mermaPct) ?? 0) > 0).length,
      criticos: alertas.filter((estado) => estado === "rojo").length,
      reorden: alertas.filter((estado) => estado === "amarillo").length,
    },
    finanzas: {
      margenObjetivo,
      overhead: decimalToNumber(config?.overheadPct ?? null) ?? 12,
    },
    semaforo: semaforo.sort((a, b) => (b.foodCostPct ?? -1) - (a.foodCostPct ?? -1)),
  };
}

export type DashboardDTO = Awaited<ReturnType<typeof getDashboard>>;
