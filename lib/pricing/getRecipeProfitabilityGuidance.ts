export type RecipeProfitabilityGuidanceKind =
  | "healthy"
  | "opportunity"
  | "adjustment"
  | "critical"
  | "missing-price";

type GuidanceInput = {
  costoPorcion: number;
  pvpCarta: number | null;
  foodCostPct: number | null;
  impuestoPct: number;
  foodCostCriticoPct: number;
  targetMinPct?: number;
  targetMaxPct?: number;
};

export type RecipeProfitabilityGuidance = {
  kind: RecipeProfitabilityGuidanceKind;
  label: string;
  deviationPct: number;
  suggestedPriceIncrease: number;
  targetCostReduction: number;
};

export function calculateFoodCostPct(
  costoPorcion: number,
  pvpCarta: number | null,
  impuestoPct: number,
): number | null {
  if (pvpCarta === null || pvpCarta <= 0) return null;
  const ventaNeta = pvpCarta / (1 + impuestoPct / 100);
  return (costoPorcion / ventaNeta) * 100;
}

export function getRecipeProfitabilityGuidance({
  costoPorcion,
  pvpCarta,
  foodCostPct,
  impuestoPct,
  foodCostCriticoPct,
  targetMinPct = 28,
  targetMaxPct = 35,
}: GuidanceInput): RecipeProfitabilityGuidance {
  if (pvpCarta === null || foodCostPct === null) {
    return {
      kind: "missing-price",
      label: "Sin PVP",
      deviationPct: 0,
      suggestedPriceIncrease: 0,
      targetCostReduction: 0,
    };
  }

  if (foodCostPct < targetMinPct) {
    return {
      kind: "opportunity",
      label: "Oportunidad comercial",
      deviationPct: targetMinPct - foodCostPct,
      suggestedPriceIncrease: 0,
      targetCostReduction: 0,
    };
  }

  if (foodCostPct <= targetMaxPct) {
    return {
      kind: "healthy",
      label: "Rentable",
      deviationPct: 0,
      suggestedPriceIncrease: 0,
      targetCostReduction: 0,
    };
  }

  const ventaNeta = pvpCarta / (1 + impuestoPct / 100);
  const pvpObjetivo = (costoPorcion / (targetMaxPct / 100)) * (1 + impuestoPct / 100);
  return {
    kind: foodCostPct > foodCostCriticoPct ? "critical" : "adjustment",
    label: foodCostPct > foodCostCriticoPct ? "Food Cost crítico" : "Food Cost alto",
    deviationPct: foodCostPct - targetMaxPct,
    suggestedPriceIncrease: Math.max(0, pvpObjetivo - pvpCarta),
    targetCostReduction: Math.max(0, costoPorcion - ventaNeta * (targetMaxPct / 100)),
  };
}
