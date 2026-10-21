import { describe, expect, it } from "vitest";
import { ventasRecetasPatchSchema } from "./validation";

const base = { periodo: "2026-10", items: [{ recetaId: "receta-1", unidadesVendidas: 10 }] };

describe("ventasRecetasPatchSchema", () => {
  it("rechaza unidadesVendidas negativas", () => {
    expect(
      ventasRecetasPatchSchema.safeParse({ periodo: "2026-10", items: [{ recetaId: "receta-1", unidadesVendidas: -1 }] }).success,
    ).toBe(false);
  });

  it("rechaza unidadesVendidas decimales", () => {
    expect(
      ventasRecetasPatchSchema.safeParse({ periodo: "2026-10", items: [{ recetaId: "receta-1", unidadesVendidas: 1.5 }] }).success,
    ).toBe(false);
  });

  it("rechaza recetaId repetido en el mismo envío", () => {
    const result = ventasRecetasPatchSchema.safeParse({
      periodo: "2026-10",
      items: [
        { recetaId: "receta-1", unidadesVendidas: 10 },
        { recetaId: "receta-1", unidadesVendidas: 20 },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rechaza un periodo con formato inválido", () => {
    expect(ventasRecetasPatchSchema.safeParse({ ...base, periodo: "2026-10-01" }).success).toBe(false);
  });

  it("acepta un envío válido", () => {
    expect(ventasRecetasPatchSchema.safeParse(base).success).toBe(true);
  });
});
