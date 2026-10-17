import { beforeEach, describe, expect, it, vi } from "vitest";
import { CONFIGURACION_COSTEO_DEFAULTS } from "./configuracion-costeo";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  findUser: vi.fn(),
  createUser: vi.fn(),
  createConfig: vi.fn(),
  createAreas: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db: { $transaction: mocks.transaction } }));

import { bootstrapOwner } from "./owner-bootstrap";

describe("bootstrapOwner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transaction.mockImplementation((operation: (tx: unknown) => unknown) => operation({
      user: { findUnique: mocks.findUser, create: mocks.createUser },
      configuracionCosteo: { create: mocks.createConfig },
      areaAlmacen: { createMany: mocks.createAreas },
    }));
    mocks.findUser.mockResolvedValue(null);
    mocks.createUser.mockResolvedValue({ id: "owner-1", email: "owner@example.com" });
  });

  it("normaliza el owner y crea configuración y áreas iniciales en la transacción", async () => {
    await expect(bootstrapOwner({
      email: "  OWNER@Example.COM ",
      passwordHash: "hash",
      restaurantName: "  Mi Restaurante  ",
    })).resolves.toEqual({ id: "owner-1", email: "owner@example.com" });

    expect(mocks.findUser).toHaveBeenCalledWith({
      where: { email: "owner@example.com" },
      select: { id: true },
    });
    expect(mocks.createUser).toHaveBeenCalledWith({
      data: {
        email: "owner@example.com",
        passwordHash: "hash",
        restaurantName: "Mi Restaurante",
      },
    });
    expect(mocks.createConfig).toHaveBeenCalledWith({
      data: { ownerId: "owner-1", ...CONFIGURACION_COSTEO_DEFAULTS },
    });
    expect(mocks.createAreas).toHaveBeenCalledWith({
      data: [
        { ownerId: "owner-1", nombre: "Cámara Fría", orden: 1 },
        { ownerId: "owner-1", nombre: "Bodega Seca", orden: 2 },
        { ownerId: "owner-1", nombre: "Barra", orden: 3 },
        { ownerId: "owner-1", nombre: "Cocina Caliente", orden: 4 },
      ],
    });
  });

  it("rechaza un correo existente sin crear recursos parciales", async () => {
    mocks.findUser.mockResolvedValue({ id: "existing-owner" });

    await expect(bootstrapOwner({
      email: "Existing@Example.com",
      passwordHash: "hash",
      restaurantName: "Duplicado",
    })).rejects.toMatchObject({ message: "Ya existe un usuario con ese correo" });

    expect(mocks.createUser).not.toHaveBeenCalled();
    expect(mocks.createConfig).not.toHaveBeenCalled();
    expect(mocks.createAreas).not.toHaveBeenCalled();
  });
});
