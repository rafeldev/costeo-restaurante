import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  recetaFindFirst: vi.fn(),
  configFindFirst: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    receta: { findFirst: mocks.recetaFindFirst },
    configuracionCosteo: { findFirst: mocks.configFindFirst },
  },
}));

import { calculateRecipeCosting } from "./calculateRecipeCosting";

describe("calculateRecipeCosting", () => {
  it("expone el porcentaje de impuesto usado para calcular el precio", async () => {
    mocks.recetaFindFirst.mockResolvedValue({
      id: "rec-1",
      rendimientoPorciones: 1,
      precioVentaActual: null,
      ingredientes: [],
    });
    mocks.configFindFirst.mockResolvedValue({
      overheadPct: 0,
      margenObjetivoPct: 50,
      impuestoPct: 19,
      redondeoPrecio: 1,
    });

    await expect(calculateRecipeCosting("rec-1", "owner-1")).resolves.toMatchObject({
      impuestoPct: 19,
    });
  });
});
