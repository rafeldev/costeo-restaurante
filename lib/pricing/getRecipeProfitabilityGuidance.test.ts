import { describe, expect, it } from "vitest";
import {
  calculateFoodCostPct,
  getRecipeProfitabilityGuidance,
} from "./getRecipeProfitabilityGuidance";

const base = {
  costoPorcion: 9_000,
  pvpCarta: 22_000,
  impuestoPct: 8,
  foodCostCriticoPct: 40,
};

describe("getRecipeProfitabilityGuidance", () => {
  it("pide definir PVP cuando no puede evaluar la receta", () => {
    expect(getRecipeProfitabilityGuidance({ ...base, pvpCarta: null, foodCostPct: null })).toMatchObject({
      kind: "missing-price",
      label: "Sin PVP",
    });
  });

  it("distingue una oportunidad comercial de una receta que requiere ajuste", () => {
    expect(getRecipeProfitabilityGuidance({ ...base, foodCostPct: 24 })).toMatchObject({
      kind: "opportunity",
      deviationPct: 4,
    });
  });

  it.each([
    [27.99, "opportunity"],
    [28, "healthy"],
    [35, "healthy"],
    [35.01, "adjustment"],
    [40, "adjustment"],
    [40.01, "critical"],
  ] as const)("clasifica el borde %s como %s", (foodCostPct, kind) => {
    expect(getRecipeProfitabilityGuidance({ ...base, foodCostPct }).kind).toBe(kind);
  });

  it("cuantifica el ajuste de precio o costo para Food Cost alto", () => {
    const guidance = getRecipeProfitabilityGuidance({
      ...base,
      foodCostPct: calculateFoodCostPct(base.costoPorcion, base.pvpCarta, base.impuestoPct),
      foodCostCriticoPct: 50,
    });

    expect(guidance).toMatchObject({
      kind: "adjustment",
      label: "Food Cost alto",
    });
    expect(guidance.suggestedPriceIncrease).toBeCloseTo(5_771.43, 2);
    expect(guidance.targetCostReduction).toBeCloseTo(1_870.37, 2);
  });

  it("identifica el Food Cost que supera el umbral crítico", () => {
    expect(getRecipeProfitabilityGuidance({ ...base, foodCostPct: 42 }).kind).toBe("critical");
  });

  it("calcula Food Cost sobre la venta neta de impuesto", () => {
    expect(calculateFoodCostPct(9_000, 22_000, 8)).toBeCloseTo(44.1818, 4);
    expect(calculateFoodCostPct(9_000, null, 8)).toBeNull();
  });
});
