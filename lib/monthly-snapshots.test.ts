import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findConfig: vi.fn(),
  findRecipes: vi.fn(),
  upsertSnapshot: vi.fn(),
  costRecipe: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    configuracionCosteo: { findUnique: mocks.findConfig },
    receta: { findMany: mocks.findRecipes },
    snapshotCosteoMensual: { upsert: mocks.upsertSnapshot },
  },
}));

vi.mock("@/lib/receta-service", () => ({
  recetaInclude: { ingredientes: true },
  costRecipe: mocks.costRecipe,
}));

import { captureMonthlyCostingSnapshot, previousMonthlyPeriod } from "./monthly-snapshots";

describe("monthly costing snapshots", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findConfig.mockResolvedValue({ id: "config-1" });
    mocks.findRecipes.mockResolvedValue([{ id: "recipe-1" }, { id: "recipe-2" }]);
    mocks.costRecipe.mockImplementation((recipe: { id: string }) =>
      recipe.id === "recipe-1"
        ? { foodCostPct: 30.111, margenContribucionPct: 50.111, estado: "Rentable" }
        : { foodCostPct: 40.111, margenContribucionPct: 60.111, estado: "Riesgo" },
    );
    mocks.upsertSnapshot.mockResolvedValue({ id: "snapshot-1" });
  });

  it("calcula el periodo anterior en UTC, incluso al cruzar de año", () => {
    expect(previousMonthlyPeriod(new Date("2026-01-15T12:00:00Z"))).toBe("2025-12");
  });

  it("captura una sola versión mensual y no la actualiza en ejecuciones posteriores", async () => {
    const expected = {
      status: "captured",
      snapshotId: "snapshot-1",
    };

    await expect(captureMonthlyCostingSnapshot("owner-1", "2026-09")).resolves.toEqual(expected);
    await expect(captureMonthlyCostingSnapshot("owner-1", "2026-09")).resolves.toEqual(expected);

    expect(mocks.findConfig).toHaveBeenCalledWith({ where: { ownerId: "owner-1" } });
    expect(mocks.findRecipes).toHaveBeenCalledWith(expect.objectContaining({
      where: { ownerId: "owner-1", activa: true, borrador: false },
    }));
    expect(mocks.upsertSnapshot).toHaveBeenCalledTimes(2);
    expect(mocks.upsertSnapshot).toHaveBeenNthCalledWith(2, {
      where: { ownerId_periodo: { ownerId: "owner-1", periodo: "2026-09" } },
      create: {
        ownerId: "owner-1",
        periodo: "2026-09",
        foodCostPct: 35.11,
        margenPct: 55.11,
        recetasActivas: 2,
        recetasRiesgo: 1,
      },
      update: {},
    });
  });

  it("no escribe cuando falta configuración", async () => {
    mocks.findConfig.mockResolvedValue(null);

    await expect(captureMonthlyCostingSnapshot("owner-1", "2026-09")).resolves.toEqual({
      status: "skipped",
      reason: "missing-config",
    });
    expect(mocks.upsertSnapshot).not.toHaveBeenCalled();
  });

  it("no escribe cuando ninguna receta activa tiene precio", async () => {
    mocks.findRecipes.mockResolvedValue([{ id: "recipe-1" }]);
    mocks.costRecipe.mockReset().mockReturnValue({
      foodCostPct: null,
      margenContribucionPct: null,
      estado: "Sin precio",
    });

    await expect(captureMonthlyCostingSnapshot("owner-1", "2026-09")).resolves.toEqual({
      status: "skipped",
      reason: "missing-priced-recipes",
    });
    expect(mocks.upsertSnapshot).not.toHaveBeenCalled();
  });
});
