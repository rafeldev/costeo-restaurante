import { describe, expect, it } from "vitest";
import { handleRouteError } from "@/lib/api-errors";
import { UnauthorizedError } from "@/lib/auth";
import {
  InsufficientStockError,
  NotFoundError,
  ValidationError,
} from "@/lib/errors";

describe("handleRouteError", () => {
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
