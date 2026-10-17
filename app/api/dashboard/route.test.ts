import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAuthUser: vi.fn(),
  getDashboard: vi.fn(),
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
  };
});

vi.mock("@/lib/dashboard", () => ({ getDashboard: mocks.getDashboard }));

import { UnauthorizedError } from "@/lib/auth";
import { GET } from "./route";

describe("GET /api/dashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna 401 JSON sin consultar datos cuando no hay sesión", async () => {
    mocks.requireAuthUser.mockRejectedValue(new UnauthorizedError());

    const response = await GET();

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ message: "No autenticado" });
    expect(mocks.getDashboard).not.toHaveBeenCalled();
  });

  it("consulta el dashboard del owner autenticado y conserva el contrato JSON", async () => {
    mocks.requireAuthUser.mockResolvedValue({ id: "owner-1", email: "owner@example.com" });
    mocks.getDashboard.mockResolvedValue({
      foodCost: { valor: 31.5, deltaMensual: -1.2, rango: "28-35%" },
      semaforo: [{ recetaId: "rec-1", pvp: 100, costo: 31.5 }],
    });

    const response = await GET();

    expect(response.status).toBe(200);
    expect(mocks.getDashboard).toHaveBeenCalledWith("owner-1");
    await expect(response.json()).resolves.toEqual({
      foodCost: { valor: 31.5, deltaMensual: -1.2, rango: "28-35%" },
      semaforo: [{ recetaId: "rec-1", pvp: 100, costo: 31.5 }],
    });
  });

  it("devuelve un error JSON estable ante fallos inesperados", async () => {
    mocks.requireAuthUser.mockResolvedValue({ id: "owner-1", email: "owner@example.com" });
    mocks.getDashboard.mockRejectedValue(new Error("database unavailable"));

    const response = await GET();

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ message: "Ocurrió un error inesperado." });
  });
});
