import { describe, expect, it } from "vitest";
import {
  calcularDiferencia,
  calcularVarianzaPct,
  getEstadoConteo,
} from "./inventory-reconciliation";

describe("conciliación de inventario", () => {
  it("calcula diferencia y varianza con la precisión del inventario", () => {
    expect(calcularDiferencia(10, 9.5)).toBe(-0.5);
    expect(calcularVarianzaPct(10, 9.5)).toBe(-5);
    expect(calcularVarianzaPct(10, null)).toBeNull();
  });

  it("clasifica los límites de tolerancia y crítico de forma inclusiva", () => {
    expect(getEstadoConteo(100, 102, 2, 5)).toBe("TOLERANCIA");
    expect(getEstadoConteo(100, 103, 2, 5)).toBe("DISCREPANCIA");
    expect(getEstadoConteo(100, 95, 2, 5)).toBe("CRITICO");
  });

  it("considera crítico un conteo positivo cuando el teórico es cero", () => {
    expect(calcularVarianzaPct(0, 1)).toBe(Infinity);
    expect(getEstadoConteo(0, 1)).toBe("CRITICO");
    expect(getEstadoConteo(0, 0)).toBe("TOLERANCIA");
  });
});
