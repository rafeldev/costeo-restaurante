import { describe, expect, it } from "vitest";
import { handleRouteError } from "@/lib/api-errors";
import { UnauthorizedError } from "@/lib/auth";
import {
  InventoryCountOpenError,
  InsufficientStockError,
  NotFoundError,
  ValidationError,
} from "@/lib/errors";

describe("handleRouteError", () => {
  it("convierte JSON mal formado en 400", async () => {
    const response = handleRouteError(new SyntaxError("Unexpected token"));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ message: "El cuerpo JSON no es válido" });
  });

  it.each([
    [new UnauthorizedError(), 401, "No autenticado"],
    [new NotFoundError("Receta no encontrada"), 404, "Receta no encontrada"],
    [new ValidationError("Datos inválidos"), 400, "Datos inválidos"],
  ])("mapea errores conocidos", async (error, status, message) => {
    const response = handleRouteError(error);

    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toEqual({ message });
  });

  it("incluye los faltantes de stock", async () => {
    const faltantes = [
      { insumoId: "ins-1", nombre: "Carne", requerido: 10, disponible: 4 },
    ];
    const response = handleRouteError(new InsufficientStockError(faltantes));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      message: "Stock insuficiente para registrar la producción",
      faltantes,
    });
  });

  it("devuelve 409 con la toma abierta que bloquea el inventario", async () => {
    const response = handleRouteError(new InventoryCountOpenError("toma-1", "2026-10"));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      code: "INVENTORY_COUNT_OPEN",
      message: "No se puede modificar el inventario mientras existe una toma abierta",
      tomaId: "toma-1",
      periodo: "2026-10",
    });
  });

  it.each([
    [{ code: "P2002" }, 409],
    [{ code: "P2003" }, 409],
    [{ code: "P2025" }, 404],
  ])("mapea errores conocidos de Prisma", async (error, status) => {
    expect(handleRouteError(error).status).toBe(status);
  });

  it("no expone el mensaje de errores inesperados", async () => {
    const response = handleRouteError(new Error("password=secreto"));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      message: "Ocurrió un error inesperado.",
    });
  });
});
