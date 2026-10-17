import { describe, expect, it } from "vitest";
import { calcularFechaVencimiento, calcularTotalesFactura } from "./facturas-compra";

describe("cálculos de factura de compra", () => {
  it("calcula subtotal, IVA por línea y total sin confiar en valores del cliente", () => {
    expect(
      calcularTotalesFactura([
        { insumoId: "a", cantidad: 2, unidad: "KILOGRAMO", precioUnitarioBruto: 100, tasaImpuestoPct: 19 },
        { insumoId: "b", cantidad: 3, unidad: "UNIDAD", precioUnitarioBruto: 50, tasaImpuestoPct: 5 },
      ]),
    ).toEqual({ subtotal: 350, impuestos: 45.5, total: 395.5 });
  });

  it("calcula vencimiento según condición y deja contado sin vencimiento", () => {
    const fecha = new Date("2026-10-12T00:00:00.000Z");
    expect(calcularFechaVencimiento(fecha, "CONTADO")).toBeNull();
    expect(calcularFechaVencimiento(fecha, "CREDITO_15")?.toISOString()).toBe("2026-10-27T00:00:00.000Z");
    expect(calcularFechaVencimiento(fecha, "CREDITO_30")?.toISOString()).toBe("2026-11-11T00:00:00.000Z");
  });
});
