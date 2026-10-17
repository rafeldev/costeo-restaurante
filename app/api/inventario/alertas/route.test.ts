import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAuthUser: vi.fn(),
  findMany: vi.fn(),
}));

vi.mock("@/lib/auth", () => {
  class UnauthorizedError extends Error {
    constructor() {
      super("No autenticado");
    }
  }

  return {
    UnauthorizedError,
    requireAuthUser: mocks.requireAuthUser,
    unauthorizedResponse: () => Response.json({ message: "No autenticado" }, { status: 401 }),
  };
});

vi.mock("@/lib/db", () => ({
  db: { inventarioInsumo: { findMany: mocks.findMany } },
}));

import { UnauthorizedError } from "@/lib/auth";
import { GET } from "./route";

const decimal = (value: number) => ({ toNumber: () => value });

describe("GET /api/inventario/alertas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna 401 sin consultar inventario cuando no hay sesión", async () => {
    mocks.requireAuthUser.mockRejectedValue(new UnauthorizedError());

    const response = await GET();

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ message: "No autenticado" });
    expect(mocks.findMany).not.toHaveBeenCalled();
  });

  it("serializa Decimal y amplía las alertas del owner autenticado", async () => {
    mocks.requireAuthUser.mockResolvedValue({ id: "owner-1", email: "owner@example.com" });
    mocks.findMany.mockResolvedValue([
      {
        insumoId: "ins-reorden",
        stockActual: decimal(11),
        stockMinimo: decimal(10),
        insumo: {
          nombre: "Arroz",
          proveedorPreferido: { id: "prov-1", nombre: "Proveedor Uno" },
        },
      },
      {
        insumoId: "ins-critico",
        stockActual: decimal(5),
        stockMinimo: decimal(10),
        insumo: { nombre: "Tomate", proveedorPreferido: null },
      },
    ]);

    const response = await GET();

    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { insumo: { ownerId: "owner-1" } },
    }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([
      {
        insumoId: "ins-critico",
        nombre: "Tomate",
        stockActual: 5,
        stockMinimo: 10,
        estadoReposicion: "rojo",
        desviacionPct: -50,
        estado: "Crítico",
        proveedorPreferido: null,
      },
      {
        insumoId: "ins-reorden",
        nombre: "Arroz",
        stockActual: 11,
        stockMinimo: 10,
        estadoReposicion: "amarillo",
        desviacionPct: 10,
        estado: "Reorden",
        proveedorPreferido: { id: "prov-1", nombre: "Proveedor Uno" },
      },
    ]);
  });
});
