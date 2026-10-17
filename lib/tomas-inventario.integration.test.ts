import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import {
  abrirTomaInventario,
  cerrarTomaInventario,
  guardarConteosInventario,
} from "@/lib/tomas-inventario";

describe("toma de inventario contra PostgreSQL", () => {
  it("permite una sola toma abierta bajo aperturas concurrentes", async () => {
    const suffix = `${Date.now()}-${Math.random()}`;
    const owner = await db.user.create({
      data: { email: `stocktake-open-${suffix}@example.com`, passwordHash: "integration-test" },
    });
    try {
      const results = await Promise.allSettled([
        abrirTomaInventario(owner.id, { periodo: "2026-10" }),
        abrirTomaInventario(owner.id, { periodo: "2026-11" }),
      ]);

      expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
      await expect(
        db.tomaInventario.count({ where: { ownerId: owner.id, estado: "EN_CURSO" } }),
      ).resolves.toBe(1);
    } finally {
      await db.user.delete({ where: { id: owner.id } });
    }
  });

  it("abre, guarda y cierra una sola vez bajo cierres concurrentes", async () => {
    const suffix = `${Date.now()}-${Math.random()}`;
    const owner = await db.user.create({
      data: { email: `stocktake-${suffix}@example.com`, passwordHash: "integration-test" },
    });
    try {
      const insumo = await db.insumo.create({
        data: {
          ownerId: owner.id,
          codigo: "INS-001",
          nombre: `Insumo ${suffix}`,
          categoria: "ABARROTES_SECOS",
          unidadBase: "UNIDAD",
          costoUnidad: 100,
          inventario: { create: { stockActual: 10, stockMinimo: 0 } },
        },
      });
      const toma = await abrirTomaInventario(owner.id, { periodo: "2026-10" });
      const conteo = await db.conteoInsumo.findUniqueOrThrow({
        where: { tomaId_insumoId: { tomaId: toma.id, insumoId: insumo.id } },
      });
      await guardarConteosInventario(
        owner.id,
        toma.id,
        { conteos: [{ id: conteo.id, stockFisico: 8, motivo: "MERMA_EXTRA", nota: null }] },
        owner.email,
      );

      const results = await Promise.all([
        cerrarTomaInventario(owner.id, toma.id, owner.email),
        cerrarTomaInventario(owner.id, toma.id, owner.email),
      ]);
      const [inventory, movements] = await Promise.all([
        db.inventarioInsumo.findUniqueOrThrow({ where: { insumoId: insumo.id } }),
        db.movimientoInventario.findMany({ where: { insumoId: insumo.id, tipo: "AJUSTE" } }),
      ]);
      expect(results.filter((result) => !result.yaCerrada)).toHaveLength(1);
      expect(inventory.stockActual.toNumber()).toBe(8);
      expect(movements).toHaveLength(1);
      expect(movements[0]!.cantidad.toNumber()).toBe(-2);
    } finally {
      await db.user.delete({ where: { id: owner.id } });
    }
  });
});

afterAll(async () => {
  await db.$disconnect();
});
