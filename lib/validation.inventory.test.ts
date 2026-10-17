import { describe, expect, it } from "vitest";
import { movimientoInventarioSchema } from "./validation";

const movement = {
  insumoId: "insumo-1",
  motivo: "Corrección de conteo",
};

describe("movimientoInventarioSchema", () => {
  it.each([10, -10])("acepta AJUSTE con cantidad firmada %s", (cantidad) => {
    expect(
      movimientoInventarioSchema.safeParse({ ...movement, tipo: "AJUSTE", cantidad }).success,
    ).toBe(true);
  });

  it.each(["ENTRADA", "SALIDA"] as const)(
    "exige una cantidad positiva para %s",
    (tipo) => {
      const result = movimientoInventarioSchema.safeParse({
        ...movement,
        tipo,
        cantidad: -1,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.cantidad).toContain(
          "La cantidad debe ser positiva",
        );
      }
    },
  );

  it.each(["ENTRADA", "SALIDA", "AJUSTE"] as const)(
    "rechaza cantidad cero para %s",
    (tipo) => {
      const result = movimientoInventarioSchema.safeParse({ ...movement, tipo, cantidad: 0 });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.cantidad).toContain(
          "La cantidad no puede ser cero",
        );
      }
    },
  );
});
