import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { registrarProduccionReceta } from "@/lib/inventory";

describe("inventario concurrente", () => {
  it("conserva todos los descuentos ejecutados en paralelo", async () => {
    const suffix = `${Date.now()}-${Math.random()}`;
    const owner = await db.user.create({
      data: {
        email: `inventory-test-${suffix}@example.com`,
        passwordHash: "integration-test",
      },
    });

    try {
      const insumo = await db.insumo.create({
        data: {
          ownerId: owner.id,
          nombre: `Insumo ${suffix}`,
          categoria: "Test",
          unidadBase: "GRAMO",
          costoUnidad: 1,
        },
      });
      const receta = await db.receta.create({
        data: {
          ownerId: owner.id,
          nombre: `Receta ${suffix}`,
          tipoProducto: "Test",
          rendimientoPorciones: 1,
          ingredientes: {
            create: { insumoId: insumo.id, cantidad: 10 },
          },
        },
      });
      await db.inventarioInsumo.create({
        data: { insumoId: insumo.id, stockActual: 1000, stockMinimo: 0 },
      });

      await Promise.all(
        Array.from({ length: 8 }, () =>
          registrarProduccionReceta({
            ownerId: owner.id,
            recetaId: receta.id,
            unidades: 1,
          }),
        ),
      );

      const inventario = await db.inventarioInsumo.findUniqueOrThrow({
        where: { insumoId: insumo.id },
      });
      expect(inventario.stockActual.toNumber()).toBe(920);
    } finally {
      await db.receta.deleteMany({ where: { ownerId: owner.id } });
      await db.user.delete({ where: { id: owner.id } });
    }
  });
});

afterAll(async () => {
  await db.$disconnect();
});
