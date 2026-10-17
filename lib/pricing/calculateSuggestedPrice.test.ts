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
    expect(result.costoPorPorcion).toBeCloseTo(2500);
    expect(result.precioSugeridoSinImpuesto).toBeCloseTo(5000);
    expect(result.precioSugeridoFinal).toBe(6000);
    expect(result.margenRealPct).toBeCloseTo(30.5, 1);
    expect(result.semaforoRentabilidad).toBe("rojo");
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
    expect(result.precioSugeridoFinal).toBe(4300);
    expect(result.margenRealPct).toBeNull();
    expect(result.semaforoRentabilidad).toBe("sin_precio");
  });

  it("reproduce el ejemplo de Stitch con margen sobre precio", () => {
    const result = calculateSuggestedPrice({
      costoMateriaPrima: 3.98,
      rendimientoPorciones: 1,
      overheadPct: 12,
      margenObjetivoPct: 56.2,
      impuestoPct: 8,
      redondeoPrecio: 0,
    });

    expect(result.precioSugeridoSinImpuesto).toBeCloseTo(12.5157, 3);
    expect(result.precioSugeridoFinal).toBeCloseTo(13.517, 3);
  });

  it("reporta el margen objetivo cuando el precio actual es el sugerido", () => {
    const input = {
      costoMateriaPrima: 3.98,
      rendimientoPorciones: 1,
      overheadPct: 12,
      margenObjetivoPct: 56.2,
      impuestoPct: 8,
      redondeoPrecio: 0,
    };
    const suggested = calculateSuggestedPrice(input);
    const result = calculateSuggestedPrice({
      ...input,
      precioVentaActual: suggested.precioSugeridoFinal,
    });

    expect(result.margenRealPct).toBeCloseTo(56.2, 8);
    expect(result.semaforoRentabilidad).toBe("verde");
  });

  it("rechaza configuraciones cuyo denominador no es positivo", () => {
    expect(() =>
      calculateSuggestedPrice({
        costoMateriaPrima: 100,
        rendimientoPorciones: 1,
        overheadPct: 40,
        margenObjetivoPct: 60,
        impuestoPct: 0,
        redondeoPrecio: 0,
      }),
    ).toThrow("menor que 100%");
  });
});
