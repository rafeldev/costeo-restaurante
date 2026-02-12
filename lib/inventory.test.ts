import { describe, expect, it } from "vitest";
import { getDeltaFromMovimiento, getEstadoReposicion } from "./inventory-rules";

describe("inventory rules", () => {
  it("calcula estado de reposicion por umbrales", () => {
    expect(getEstadoReposicion(4, 10)).toBe("rojo");
    expect(getEstadoReposicion(11, 10)).toBe("amarillo");
    expect(getEstadoReposicion(15, 10)).toBe("verde");
  });

  it("calcula delta correcto por tipo de movimiento", () => {
    expect(getDeltaFromMovimiento("ENTRADA", 5)).toBe(5);
    expect(getDeltaFromMovimiento("SALIDA", 5)).toBe(-5);
    expect(getDeltaFromMovimiento("AJUSTE", -2)).toBe(-2);
  });
});
