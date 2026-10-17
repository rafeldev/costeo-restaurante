import { describe, expect, it } from "vitest";
import { getEstadoRentabilidad } from "./getEstadoRentabilidad";

describe("getEstadoRentabilidad", () => {
  const config = { foodCostCriticoPct: 40 };

  it.each([
    [null, "Sin dato"],
    [27.99, "Ajustar"],
    [28, "Rentable"],
    [35, "Rentable"],
    [35.01, "Ajustar"],
    [40, "Ajustar"],
    [40.01, "Riesgo"],
  ] as const)("clasifica %s como %s", (foodCostPct, expected) => {
    expect(getEstadoRentabilidad(foodCostPct, config)).toBe(expected);
  });

  it("conserva la precedencia del rango objetivo aunque el umbral crítico esté mal configurado", () => {
    expect(getEstadoRentabilidad(24, { foodCostCriticoPct: 20 })).toBe("Ajustar");
    expect(getEstadoRentabilidad(30, { foodCostCriticoPct: 20 })).toBe("Rentable");
    expect(getEstadoRentabilidad(36, { foodCostCriticoPct: 20 })).toBe("Riesgo");
  });
});
