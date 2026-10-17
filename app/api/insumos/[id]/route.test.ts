import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAuthUser: vi.fn(),
  updateInsumo: vi.fn(),
  serializeInsumo: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  UnauthorizedError: class UnauthorizedError extends Error {},
  requireAuthUser: mocks.requireAuthUser,
}));

vi.mock("@/lib/insumo-service", () => ({
  updateInsumo: mocks.updateInsumo,
}));

vi.mock("@/lib/insumos", () => ({
  serializeInsumo: mocks.serializeInsumo,
}));

import { PATCH } from "./route";

describe("PATCH /api/insumos/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAuthUser.mockResolvedValue({ id: "owner-1" });
    mocks.updateInsumo.mockResolvedValue({ id: "insumo-1" });
    mocks.serializeInsumo.mockReturnValue({ id: "insumo-1" });
  });

  it("actualiza un insumo con datos de presentación válidos", async () => {
    const body = {
      nombre: "Carne de res molida",
      categoria: "PROTEINAS_CARNES",
      unidadBase: "GRAMO",
      costoUnidad: 30,
      mermaPct: 5,
      presentacionCantidad: 1,
      presentacionUnidad: "KILOGRAMO",
      precioPresentacion: 30000,
      proveedorPreferidoId: "proveedor-1",
      activo: true,
    };
    const request = new Request("http://localhost/api/insumos/insumo-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const response = await PATCH(request, {
      params: Promise.resolve({ id: "insumo-1" }),
    });

    expect(response.status).toBe(200);
    expect(mocks.updateInsumo).toHaveBeenCalledWith("owner-1", "insumo-1", body);
    await expect(response.json()).resolves.toEqual({ id: "insumo-1" });
  });

  it("actualiza parcialmente sin inyectar los defaults de mermaPct y activo", async () => {
    const request = new Request("http://localhost/api/insumos/insumo-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: "Carne molida premium" }),
    });

    const response = await PATCH(request, {
      params: Promise.resolve({ id: "insumo-1" }),
    });

    expect(response.status).toBe(200);
    expect(mocks.updateInsumo).toHaveBeenCalledWith("owner-1", "insumo-1", {
      nombre: "Carne molida premium",
    });
  });

  it("normaliza los números de una presentación completa", async () => {
    const request = new Request("http://localhost/api/insumos/insumo-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        presentacionCantidad: "2,5",
        presentacionUnidad: "KILOGRAMO",
        precioPresentacion: "45000",
      }),
    });

    const response = await PATCH(request, {
      params: Promise.resolve({ id: "insumo-1" }),
    });

    expect(response.status).toBe(200);
    expect(mocks.updateInsumo).toHaveBeenCalledWith("owner-1", "insumo-1", {
      presentacionCantidad: 2.5,
      presentacionUnidad: "KILOGRAMO",
      precioPresentacion: 45000,
    });
  });

  it("permite limpiar una presentación enviando sus tres campos nulos", async () => {
    const body = {
      presentacionCantidad: null,
      presentacionUnidad: null,
      precioPresentacion: null,
    };
    const request = new Request("http://localhost/api/insumos/insumo-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const response = await PATCH(request, {
      params: Promise.resolve({ id: "insumo-1" }),
    });

    expect(response.status).toBe(200);
    expect(mocks.updateInsumo).toHaveBeenCalledWith("owner-1", "insumo-1", body);
  });

  it("devuelve 400 para una presentación incompleta", async () => {
    const request = new Request("http://localhost/api/insumos/insumo-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        presentacionCantidad: 1,
        presentacionUnidad: "KILOGRAMO",
      }),
    });

    const response = await PATCH(request, {
      params: Promise.resolve({ id: "insumo-1" }),
    });
    const responseBody = await response.json();

    expect(response.status).toBe(400);
    expect(responseBody).toMatchObject({
      message: "Datos inválidos.",
      issues: {
        fieldErrors: {
          presentacionCantidad: ["Completa cantidad, unidad y precio de la presentación"],
        },
      },
    });
    expect(mocks.updateInsumo).not.toHaveBeenCalled();
  });

  it("devuelve 400 para valores numéricos no parseables", async () => {
    const request = new Request("http://localhost/api/insumos/insumo-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ costoUnidad: "no-es-un-numero" }),
    });

    const response = await PATCH(request, {
      params: Promise.resolve({ id: "insumo-1" }),
    });

    expect(response.status).toBe(400);
    expect(mocks.updateInsumo).not.toHaveBeenCalled();
  });
});
