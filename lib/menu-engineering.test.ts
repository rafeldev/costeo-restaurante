import { describe, expect, it } from "vitest";
import { calculateFoodCostPonderado, calculateUmbrales, classifyCuadrante } from "@/lib/menu-engineering";

describe("classifyCuadrante", () => {
  it("clasifica Estrella cuando unidades y margen superan el umbral", () => {
    expect(
      classifyCuadrante({ unidadesVendidas: 840, margenUnitario: 8.15, umbralUnidades: 240, umbralMargen: 6.28, tieneVentaRegistrada: true }),
    ).toBe("Estrella");
  });

  it("clasifica Caballo de Batalla con alta popularidad y bajo margen", () => {
    expect(
      classifyCuadrante({ unidadesVendidas: 1120, margenUnitario: 3.9, umbralUnidades: 240, umbralMargen: 6.28, tieneVentaRegistrada: true }),
    ).toBe("Caballo de Batalla");
  });

  it("clasifica Puzzle con baja popularidad y alto margen", () => {
    expect(
      classifyCuadrante({ unidadesVendidas: 190, margenUnitario: 13.15, umbralUnidades: 240, umbralMargen: 6.28, tieneVentaRegistrada: true }),
    ).toBe("Puzzle");
  });

  it("clasifica Perro con baja popularidad y bajo margen", () => {
    expect(
      classifyCuadrante({ unidadesVendidas: 45, margenUnitario: 3.0, umbralUnidades: 240, umbralMargen: 6.28, tieneVentaRegistrada: true }),
    ).toBe("Perro");
  });

  it("devuelve Sin dato sin venta registrada", () => {
    expect(
      classifyCuadrante({ unidadesVendidas: 0, margenUnitario: 10.4, umbralUnidades: 240, umbralMargen: 6.28, tieneVentaRegistrada: false }),
    ).toBe("Sin dato");
  });

  it("devuelve Sin dato sin PVP de carta (margenUnitario null)", () => {
    expect(
      classifyCuadrante({ unidadesVendidas: 100, margenUnitario: null, umbralUnidades: 240, umbralMargen: 6.28, tieneVentaRegistrada: true }),
    ).toBe("Sin dato");
  });
});

describe("calculateUmbrales", () => {
  it("promedia solo los items con venta registrada y margen conocido", () => {
    const result = calculateUmbrales([
      { unidadesVendidas: 840, margenUnitario: 8.15, tieneVentaRegistrada: true },
      { unidadesVendidas: 40, margenUnitario: 4.41, tieneVentaRegistrada: true },
      { unidadesVendidas: 0, margenUnitario: null, tieneVentaRegistrada: false },
    ]);
    expect(result).toEqual({ umbralUnidades: 440, umbralMargen: 6.28 });
  });

  it("devuelve null cuando ningún item tiene venta registrada", () => {
    expect(
      calculateUmbrales([{ unidadesVendidas: 0, margenUnitario: null, tieneVentaRegistrada: false }]),
    ).toBeNull();
  });
});

describe("calculateFoodCostPonderado", () => {
  it("pondera por unidades vendidas", () => {
    const result = calculateFoodCostPonderado([
      { costoPorcion: 2.8, ventaNeta: 10.14, unidadesVendidas: 840, tieneVentaRegistrada: true },
      { costoPorcion: 0.9, ventaNeta: 4.44, unidadesVendidas: 1120, tieneVentaRegistrada: true },
    ]);
    expect(result).not.toBeNull();
    expect(result!).toBeGreaterThan(0);
  });

  it("devuelve null sin recetas con PVP y venta registrada", () => {
    expect(
      calculateFoodCostPonderado([{ costoPorcion: 2.8, ventaNeta: null, unidadesVendidas: 0, tieneVentaRegistrada: false }]),
    ).toBeNull();
  });
});
