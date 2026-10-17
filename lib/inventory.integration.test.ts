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
          codigo: "INS-001",
          nombre: `Insumo ${suffix}`,
          categoria: "ABARROTES_SECOS",
          unidadBase: "GRAMO",
          costoUnidad: 1,
        },
      });
      const receta = await db.receta.create({
        data: {
          ownerId: owner.id,
          codigo: "RC-001",
          nombre: `Receta ${suffix}`,
          categoria: "PLATOS_FUERTES",
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

  it("permite solo las producciones cubiertas por el stock disponible", async () => {
    const suffix = `${Date.now()}-${Math.random()}`;
    const owner = await db.user.create({
      data: {
        email: `stock-test-${suffix}@example.com`,
        passwordHash: "integration-test",
      },
    });

    try {
      const insumo = await db.insumo.create({
        data: {
          ownerId: owner.id,
          codigo: "INS-001",
          nombre: `Insumo ${suffix}`,
          categoria: "ABARROTES_SECOS",
          unidadBase: "GRAMO",
          costoUnidad: 1,
        },
      });
      const receta = await db.receta.create({
        data: {
          ownerId: owner.id,
          codigo: "RC-001",
          nombre: `Receta ${suffix}`,
          categoria: "PLATOS_FUERTES",
          rendimientoPorciones: 1,
          ingredientes: {
            create: { insumoId: insumo.id, cantidad: 10 },
          },
        },
      });
      await db.inventarioInsumo.create({
        data: { insumoId: insumo.id, stockActual: 50, stockMinimo: 0 },
      });

      const results = await Promise.allSettled(
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

      expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(5);
      expect(results.filter((result) => result.status === "rejected")).toHaveLength(3);
      expect(inventario.stockActual.toNumber()).toBe(0);
    } finally {
      await db.receta.deleteMany({ where: { ownerId: owner.id } });
      await db.user.delete({ where: { id: owner.id } });
    }
  });
});

afterAll(async () => {
  await db.$disconnect();
});
