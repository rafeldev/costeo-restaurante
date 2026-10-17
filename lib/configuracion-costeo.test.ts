import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { configuracionCosteoPatchSchema, configuracionCosteoSchema } from "./validation";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  configUpsert: vi.fn(),
  configUpdate: vi.fn(),
  auditCreateMany: vi.fn(),
  auditFindMany: vi.fn(),
  recetaFindFirst: vi.fn(),
  calculateRecipeCosting: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    $transaction: mocks.transaction,
    configuracionCosteo: { upsert: mocks.configUpsert },
    configuracionCosteoAuditoria: { findMany: mocks.auditFindMany },
    receta: { findFirst: mocks.recetaFindFirst },
  },
}));

vi.mock("@/lib/pricing/calculateRecipeCosting", () => ({
  calculateRecipeCosting: mocks.calculateRecipeCosting,
}));

import {
  actualizarConfiguracionCosteo,
  CONFIGURACION_COSTEO_DEFAULTS,
  obtenerAuditoriaConfiguracion,
  obtenerSimulacionCosteo,
  restaurarConfiguracionCosteo,
} from "./configuracion-costeo";

const now = new Date("2026-10-12T12:00:00.000Z");

function config(overrides: Record<string, unknown> = {}) {
  return {
    id: "config-1",
    ownerId: "owner-1",
    overheadPct: new Prisma.Decimal(12),
    margenObjetivoPct: new Prisma.Decimal(56.2),
    regimenTributario: "IMPOCONSUMO_8" as const,
    impuestoPct: new Prisma.Decimal(8),
    redondeoPrecio: new Prisma.Decimal(100),
    foodCostCriticoPct: new Prisma.Decimal(35),
    margenMinimoPct: new Prisma.Decimal(40),
    alertaVolatilidadActiva: true,
    umbralVolatilidadPct: new Prisma.Decimal(15),
    toleranciaInventarioPct: new Prisma.Decimal(2),
    criticoInventarioPct: new Prisma.Decimal(5),
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("configuración global de costeo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const tx = {
      configuracionCosteo: {
        upsert: mocks.configUpsert,
        update: mocks.configUpdate,
      },
      configuracionCosteoAuditoria: { createMany: mocks.auditCreateMany },
    };
    mocks.transaction.mockImplementation((callback: (client: typeof tx) => unknown) => callback(tx));
    mocks.configUpsert.mockResolvedValue(config());
    mocks.configUpdate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => config(data));
    mocks.auditCreateMany.mockResolvedValue({ count: 0 });
  });

  it("actualiza parcialmente en transacción y audita una fila por campo realmente cambiado", async () => {
    const updated = await actualizarConfiguracionCosteo("owner-1", "user-1", {
      regimenTributario: "IVA_19",
      margenMinimoPct: 45,
    });

    expect(updated.regimenTributario).toBe("IVA_19");
    expect(mocks.configUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ regimenTributario: "IVA_19", impuestoPct: 19, margenMinimoPct: 45 }),
    }));
    expect(mocks.auditCreateMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ ownerId: "owner-1", usuarioId: "user-1", campo: "regimenTributario", valorAnterior: "IMPOCONSUMO_8", valorNuevo: "IVA_19" }),
        expect.objectContaining({ campo: "impuestoPct", valorAnterior: "8", valorNuevo: "19" }),
        expect.objectContaining({ campo: "margenMinimoPct", valorAnterior: "40", valorNuevo: "45" }),
      ]),
    });
    expect(mocks.auditCreateMany.mock.calls[0]![0].data).toHaveLength(3);
  });

  it("restaura los defaults Stitch sin saltarse la auditoría", async () => {
    mocks.configUpsert.mockResolvedValue(config({
      overheadPct: new Prisma.Decimal(20),
      margenObjetivoPct: new Prisma.Decimal(40),
      regimenTributario: "IVA_19",
      impuestoPct: new Prisma.Decimal(19),
      alertaVolatilidadActiva: false,
    }));

    await restaurarConfiguracionCosteo("owner-1", "user-1");

    expect(mocks.configUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining(CONFIGURACION_COSTEO_DEFAULTS),
    }));
    expect(mocks.auditCreateMany).toHaveBeenCalledOnce();
  });

  it("limita la auditoría al owner autenticado", async () => {
    mocks.auditFindMany.mockResolvedValue([]);
    await obtenerAuditoriaConfiguracion("owner-1", 12);
    expect(mocks.auditFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { ownerId: "owner-1" },
      take: 12,
    }));
  });

  it("simula con una receta tenant-safe y la fórmula de margen sobre precio", async () => {
    mocks.configUpsert.mockResolvedValue(config({ redondeoPrecio: new Prisma.Decimal(0) }));
    mocks.recetaFindFirst.mockResolvedValue({
      id: "receta-1",
      nombre: "Plato de prueba",
      rendimientoPorciones: 1,
      precioVentaActual: null,
    });
    mocks.calculateRecipeCosting.mockResolvedValue({ costoMateriaPrima: 3.98 });

    const result = await obtenerSimulacionCosteo("owner-1", "receta-1");

    expect(mocks.recetaFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "receta-1", ownerId: "owner-1" },
    }));
    expect(mocks.calculateRecipeCosting).toHaveBeenCalledWith("receta-1", "owner-1");
    expect(result.precioSugeridoSinImpuesto).toBeCloseTo(12.5157, 3);
    expect(result.precioSugeridoFinal).toBeCloseTo(13.517, 3);
  });
});

describe("validación de configuración", () => {
  it("admite PATCH parcial y rechaza redondeos o campos arbitrarios", () => {
    expect(configuracionCosteoPatchSchema.safeParse({ margenMinimoPct: 42 }).success).toBe(true);
    expect(configuracionCosteoPatchSchema.safeParse({ redondeoPrecio: 10 }).success).toBe(false);
    expect(configuracionCosteoPatchSchema.safeParse({ impuestoPct: 19 }).success).toBe(false);
    expect(configuracionCosteoPatchSchema.safeParse({}).success).toBe(false);
  });

  it("rechaza combinaciones financieras e inventario inconsistentes", () => {
    expect(configuracionCosteoSchema.safeParse({
      ...CONFIGURACION_COSTEO_DEFAULTS,
      overheadPct: 30,
      margenObjetivoPct: 70,
    }).success).toBe(false);
    expect(configuracionCosteoSchema.safeParse({
      ...CONFIGURACION_COSTEO_DEFAULTS,
      toleranciaInventarioPct: 5,
      criticoInventarioPct: 5,
    }).success).toBe(false);
  });
});
