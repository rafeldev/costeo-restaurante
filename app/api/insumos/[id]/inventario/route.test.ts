import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAuthUser: vi.fn(),
  findInsumo: vi.fn(),
  findArea: vi.fn(),
  transaction: vi.fn(),
  updateInsumo: vi.fn(),
  upsertInventario: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  UnauthorizedError: class UnauthorizedError extends Error {},
  requireAuthUser: mocks.requireAuthUser,
}));

vi.mock("@/lib/db", () => ({
  db: {
    insumo: { findFirst: mocks.findInsumo },
    areaAlmacen: { findFirst: mocks.findArea },
    $transaction: mocks.transaction,
  },
}));

import { PATCH } from "./route";

const context = { params: Promise.resolve({ id: "insumo-1" }) };
const decimal = (value: number) => ({ toNumber: () => value });

function patch(body: unknown) {
  return PATCH(
    new Request("http://localhost/api/insumos/insumo-1/inventario", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    context,
  );
}

describe("PATCH /api/insumos/[id]/inventario", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAuthUser.mockResolvedValue({ id: "owner-1" });
    mocks.findInsumo.mockResolvedValue({ id: "insumo-1" });
    mocks.findArea.mockResolvedValue({ id: "area-1" });
    mocks.updateInsumo.mockResolvedValue({ id: "insumo-1" });
    mocks.upsertInventario.mockResolvedValue({
      insumoId: "insumo-1",
      stockActual: decimal(8),
      stockMinimo: decimal(3),
      updatedAt: new Date("2026-10-17T00:00:00Z"),
    });
    mocks.transaction.mockImplementation(
      (operation: (tx: unknown) => unknown) => operation({
        insumo: { update: mocks.updateInsumo },
        inventarioInsumo: { upsert: mocks.upsertInventario },
      }),
    );
  });

  it("verifica que el insumo y el área pertenezcan al owner antes de actualizar", async () => {
    const response = await patch({ stockMinimo: "3", areaId: "area-1" });

    expect(response.status).toBe(200);
    expect(mocks.findInsumo).toHaveBeenCalledWith({
      where: { id: "insumo-1", ownerId: "owner-1" },
      select: { id: true },
    });
    expect(mocks.findArea).toHaveBeenCalledWith({
      where: { id: "area-1", ownerId: "owner-1" },
      select: { id: true },
    });
    expect(mocks.updateInsumo).toHaveBeenCalledWith({
      where: { id: "insumo-1" },
      data: { areaId: "area-1" },
    });
    expect(mocks.upsertInventario).toHaveBeenCalledWith({
      where: { insumoId: "insumo-1" },
      create: { insumoId: "insumo-1", stockActual: 0, stockMinimo: 3 },
      update: { stockMinimo: 3 },
    });
  });

  it("rechaza un insumo ajeno antes de consultar el área o abrir la transacción", async () => {
    mocks.findInsumo.mockResolvedValue(null);

    const response = await patch({ stockMinimo: 3, areaId: "area-1" });

    expect(response.status).toBe(404);
    expect(mocks.findArea).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rechaza un área ajena antes de modificar el mínimo", async () => {
    mocks.findArea.mockResolvedValue(null);

    const response = await patch({ stockMinimo: 3, areaId: "foreign-area" });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ message: "Área no encontrada" });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rechaza mínimos negativos sin consultar áreas ni escribir", async () => {
    const response = await patch({ stockMinimo: -0.01, areaId: "area-1" });

    expect(response.status).toBe(400);
    expect(mocks.findArea).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
