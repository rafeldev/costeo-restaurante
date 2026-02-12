import { describe, expect, it } from "vitest";
import { calculateSuggestedPrice } from "./calculateSuggestedPrice";

describe("calculateSuggestedPrice", () => {
  it("calcula costos y precio sugerido con redondeo", () => {
    const result = calculateSuggestedPrice({
      costoMateriaPrima: 10000,
      rendimientoPorciones: 4,
      overheadPct: 10,
      margenObjetivoPct: 40,
      impuestoPct: 19,
      redondeoPrecio: 100,
      precioVentaActual: 5000,
    });

    expect(result.costoTotal).toBeCloseTo(11000);
    expect(result.costoPorPorcion).toBeCloseTo(2750);
    expect(result.precioSugeridoSinImpuesto).toBeCloseTo(3850);
    expect(result.precioSugeridoFinal).toBe(4600);
    expect(result.margenRealPct).toBeCloseTo(45);
    expect(result.semaforoRentabilidad).toBe("verde");
  });

  it("retorna semáforo sin precio cuando no hay precio actual", () => {
    const result = calculateSuggestedPrice({
      costoMateriaPrima: 6000,
      rendimientoPorciones: 2,
      overheadPct: 0,
      margenObjetivoPct: 30,
      impuestoPct: 0,
      redondeoPrecio: 50,
      precioVentaActual: null,
    });

    expect(result.costoPorPorcion).toBe(3000);
    expect(result.precioSugeridoFinal).toBe(3900);
    expect(result.margenRealPct).toBeNull();
    expect(result.semaforoRentabilidad).toBe("sin_precio");
  });
});
