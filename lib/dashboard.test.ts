import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  recetaFindMany: vi.fn(),
  insumoFindMany: vi.fn(),
  configFindFirst: vi.fn(),
  snapshotFindUnique: vi.fn(),
  calculateRecipeCosting: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    receta: { findMany: mocks.recetaFindMany },
    insumo: { findMany: mocks.insumoFindMany },
    configuracionCosteo: { findFirst: mocks.configFindFirst },
    snapshotCosteoMensual: { findUnique: mocks.snapshotFindUnique },
  },
}));

vi.mock("@/lib/pricing/calculateRecipeCosting", () => ({
  calculateRecipeCosting: mocks.calculateRecipeCosting,
}));

import { getDashboard } from "./dashboard";

const decimal = (value: number) => ({ toNumber: () => value });

function costeo(costoPorPorcion: number, margenRealPct: number | null) {
  return {
    costoMateriaPrima: costoPorPorcion,
    costoTotal: costoPorPorcion,
    costoPorPorcion,
    precioSugeridoSinImpuesto: 0,
    precioSugeridoFinal: 0,
    impuestoPct: 8,
    margenRealPct,
    semaforoRentabilidad: margenRealPct === null ? "sin_precio" : "verde",
    desgloseIngredientes: [],
  };
}

describe("getDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.configFindFirst.mockResolvedValue({
      margenObjetivoPct: decimal(56.2),
      overheadPct: decimal(12),
      impuestoPct: decimal(8),
    });
  });

  it("agrega recetas e inventario, convierte Decimal y usa el snapshot del período anterior", async () => {
    mocks.recetaFindMany.mockResolvedValue([
      { id: "rec-1", nombre: "Rentable", precioVentaActual: decimal(100) },
      { id: "rec-2", nombre: "Riesgo", precioVentaActual: decimal(50) },
      { id: "rec-3", nombre: "Sin precio", precioVentaActual: null },
    ]);
    mocks.insumoFindMany.mockResolvedValue([
      { mermaPct: decimal(10), inventario: { stockActual: decimal(5), stockMinimo: decimal(10) } },
      { mermaPct: decimal(2), inventario: { stockActual: decimal(11), stockMinimo: decimal(10) } },
      { mermaPct: decimal(0), inventario: { stockActual: decimal(20), stockMinimo: decimal(10) } },
    ]);
    mocks.calculateRecipeCosting.mockImplementation(async (id: string) => {
      if (id === "rec-1") return costeo(30, 70);
      if (id === "rec-2") return costeo(20, 60);
      return costeo(10, null);
    });
    mocks.snapshotFindUnique.mockResolvedValue({ foodCostPct: decimal(32), margenPct: decimal(63), recetasActivas: 2 });

    const result = await getDashboard("owner-1", new Date("2026-10-12T12:00:00Z"));

    expect(mocks.recetaFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { ownerId: "owner-1", activa: true, borrador: false },
      }),
    );
    expect(mocks.insumoFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: { ownerId: "owner-1" } }));
    expect(mocks.snapshotFindUnique).toHaveBeenCalledWith({
      where: { ownerId_periodo: { ownerId: "owner-1", periodo: "2026-09" } },
    });
    expect(result).toMatchObject({
      foodCost: { valor: 37.8, deltaMensual: 5.8, rango: "28-35%" },
      margen: { valor: 65, deltaVsObjetivo: 8.8 },
      recetas: { activas: 3, enRiesgo: 1, aRevisar: 0 },
      insumos: { total: 3, conMerma: 2, criticos: 1, reorden: 1 },
      finanzas: { margenObjetivo: 56.2, overhead: 12 },
    });
    expect(result.semaforo.map((item) => item.estado)).toEqual(["Riesgo", "Rentable", "Sin dato"]);
    expect(result.semaforo.every((item) => item.pvp === null || typeof item.pvp === "number")).toBe(true);
  });

  it("devuelve agregados estables cuando no existen recetas ni inventario", async () => {
    mocks.recetaFindMany.mockResolvedValue([]);
    mocks.insumoFindMany.mockResolvedValue([]);
    mocks.snapshotFindUnique.mockResolvedValue(null);

    const result = await getDashboard("owner-1", new Date("2026-01-15T12:00:00Z"));

    expect(mocks.calculateRecipeCosting).not.toHaveBeenCalled();
    expect(mocks.snapshotFindUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { ownerId_periodo: { ownerId: "owner-1", periodo: "2025-12" } },
    }));
    expect(result).toMatchObject({
      foodCost: { valor: null, deltaMensual: null },
      margen: { valor: null, deltaVsObjetivo: null },
      recetas: { activas: 0, enRiesgo: 0, aRevisar: 0 },
      insumos: { total: 0, conMerma: 0, criticos: 0, reorden: 0 },
      semaforo: [],
    });
  });
});
