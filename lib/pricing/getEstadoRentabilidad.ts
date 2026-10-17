export type EstadoRentabilidad = "Rentable" | "Ajustar" | "Riesgo" | "Sin dato";

export function getEstadoRentabilidad(
  foodCostPct: number | null,
  config: {
    foodCostObjetivoMinPct?: number;
    foodCostObjetivoMaxPct?: number;
    foodCostCriticoPct: number;
  },
): EstadoRentabilidad {
  if (foodCostPct === null || !Number.isFinite(foodCostPct)) return "Sin dato";

  const min = config.foodCostObjetivoMinPct ?? 28;
  const max = config.foodCostObjetivoMaxPct ?? 35;
  if (foodCostPct < min) return "Ajustar";
  if (foodCostPct >= min && foodCostPct <= max) return "Rentable";
  if (foodCostPct > config.foodCostCriticoPct) return "Riesgo";
  return "Ajustar";
}
