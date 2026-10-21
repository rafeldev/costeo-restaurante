import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { upsertVentasRecetas, getMezclaMenu } from "@/lib/ventas-service";

describe("ventas de recetas contra PostgreSQL", () => {
  it("upserta ventas propias y rechaza recetaId de otro owner", async () => {
    const suffix = `${Date.now()}-${Math.random()}`;
    const owner = await db.user.create({ data: { email: `ventas-${suffix}@example.com`, passwordHash: "integration-test" } });
    const otherOwner = await db.user.create({ data: { email: `ventas-other-${suffix}@example.com`, passwordHash: "integration-test" } });
    try {
      const receta = await db.receta.create({
        data: { ownerId: owner.id, codigo: "RC-901", nombre: `Receta ${suffix}`, categoria: "PLATOS_FUERTES", rendimientoPorciones: 1, precioVentaActual: 20, activa: true, borrador: false },
      });
      const foreignReceta = await db.receta.create({
        data: { ownerId: otherOwner.id, codigo: "RC-902", nombre: `Receta ajena ${suffix}`, categoria: "PLATOS_FUERTES", rendimientoPorciones: 1, activa: true, borrador: false },
      });

      await upsertVentasRecetas(owner.id, { periodo: "2026-10", items: [{ recetaId: receta.id, unidadesVendidas: 50 }] });
      await expect(
        db.ventaReceta.findUniqueOrThrow({ where: { ownerId_recetaId_periodo: { ownerId: owner.id, recetaId: receta.id, periodo: "2026-10" } } }),
      ).resolves.toMatchObject({ unidadesVendidas: 50 });

      await upsertVentasRecetas(owner.id, { periodo: "2026-10", items: [{ recetaId: receta.id, unidadesVendidas: 75 }] });
      await expect(
        db.ventaReceta.findUniqueOrThrow({ where: { ownerId_recetaId_periodo: { ownerId: owner.id, recetaId: receta.id, periodo: "2026-10" } } }),
      ).resolves.toMatchObject({ unidadesVendidas: 75 });

      await expect(
        upsertVentasRecetas(owner.id, { periodo: "2026-10", items: [{ recetaId: foreignReceta.id, unidadesVendidas: 10 }] }),
      ).rejects.toThrow();
      await expect(db.ventaReceta.findFirst({ where: { recetaId: foreignReceta.id } })).resolves.toBeNull();
    } finally {
      await db.user.delete({ where: { id: owner.id } });
      await db.user.delete({ where: { id: otherOwner.id } });
    }
  });

  it("getMezclaMenu excluye del cuadrante a las recetas sin venta registrada", async () => {
    const suffix = `${Date.now()}-${Math.random()}`;
    const owner = await db.user.create({ data: { email: `mezcla-${suffix}@example.com`, passwordHash: "integration-test" } });
    try {
      await db.configuracionCosteo.create({ data: { ownerId: owner.id } });
      const conVenta = await db.receta.create({
        data: { ownerId: owner.id, codigo: "RC-903", nombre: `Con venta ${suffix}`, categoria: "PLATOS_FUERTES", rendimientoPorciones: 1, precioVentaActual: 20, activa: true, borrador: false },
      });
      await db.receta.create({
        data: { ownerId: owner.id, codigo: "RC-904", nombre: `Sin venta ${suffix}`, categoria: "PLATOS_FUERTES", rendimientoPorciones: 1, precioVentaActual: 20, activa: true, borrador: false },
      });
      await upsertVentasRecetas(owner.id, { periodo: "2026-10", items: [{ recetaId: conVenta.id, unidadesVendidas: 30 }] });

      const resultado = await getMezclaMenu(owner.id, "2026-10");
      expect(resultado.kpis.sinDato).toBe(1);
      const sinVenta = resultado.items.find((item) => item.recetaId !== conVenta.id)!;
      expect(sinVenta.cuadrante).toBe("Sin dato");
    } finally {
      await db.user.delete({ where: { id: owner.id } });
    }
  });
});

afterAll(async () => {
  await db.$disconnect();
});
