import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { aplicarFacturaCompra, crearFacturaCompra } from "@/lib/facturas-compra";

async function fixture() {
  const suffix = `${Date.now()}-${Math.random()}`;
  const owner = await db.user.create({
    data: { email: `invoice-${suffix}@example.com`, passwordHash: "integration-test" },
  });
  const other = await db.user.create({
    data: { email: `invoice-other-${suffix}@example.com`, passwordHash: "integration-test" },
  });
  const proveedor = await db.proveedor.create({
    data: { ownerId: owner.id, codigo: "PROV-001", nombre: `Proveedor ${suffix}` },
  });
  const insumo = await db.insumo.create({
    data: {
      ownerId: owner.id,
      codigo: "INS-001",
      nombre: `Harina ${suffix}`,
      categoria: "ABARROTES_SECOS",
      unidadBase: "GRAMO",
      costoUnidad: 1,
    },
  });
  return { owner, other, proveedor, insumo };
}

async function cleanup(ownerIds: string[]) {
  await db.user.deleteMany({ where: { id: { in: ownerIds } } });
}

describe("facturas de compra transaccionales", () => {
  it("aplica todas las líneas una vez y respeta el tenant", async () => {
    const data = await fixture();
    try {
      const factura = await crearFacturaCompra(data.owner.id, {
        proveedorId: data.proveedor.id,
        tipo: "FAC",
        numero: "001",
        fechaEmision: "2026-10-12",
        condicionPago: "CREDITO_15",
        actualizaCostos: true,
        aplicar: true,
        lineas: [{
          insumoId: data.insumo.id,
          cantidad: 2,
          unidad: "KILOGRAMO",
          precioUnitarioBruto: 10000,
          tasaImpuestoPct: 19,
        }],
      });
      expect(factura.estado).toBe("APLICADA");
      expect(factura.lineas[0]?.compraInsumoId).toBeTruthy();

      await aplicarFacturaCompra(data.owner.id, factura.id);
      const [inventario, compras, refreshed] = await Promise.all([
        db.inventarioInsumo.findUniqueOrThrow({ where: { insumoId: data.insumo.id } }),
        db.compraInsumo.count({ where: { insumoId: data.insumo.id } }),
        db.insumo.findUniqueOrThrow({ where: { id: data.insumo.id } }),
      ]);
      expect(inventario.stockActual.toNumber()).toBe(2000);
      expect(compras).toBe(1);
      expect(refreshed.costoUnidad.toNumber()).toBe(10);
      await expect(aplicarFacturaCompra(data.other.id, factura.id)).rejects.toThrow("Factura no encontrada");
    } finally {
      await cleanup([data.owner.id, data.other.id]);
    }
  });

  it("revierte factura, compras y stock si una línea no se puede convertir", async () => {
    const data = await fixture();
    try {
      await expect(
        crearFacturaCompra(data.owner.id, {
          proveedorId: data.proveedor.id,
          tipo: "FAC",
          numero: "ROLLBACK",
          fechaEmision: "2026-10-12",
          condicionPago: "CONTADO",
          actualizaCostos: true,
          aplicar: true,
          lineas: [
            { insumoId: data.insumo.id, cantidad: 1, unidad: "KILOGRAMO", precioUnitarioBruto: 1000, tasaImpuestoPct: 0 },
            { insumoId: data.insumo.id, cantidad: 1, unidad: "LITRO", precioUnitarioBruto: 1000, tasaImpuestoPct: 0 },
          ],
        }),
      ).rejects.toThrow("No fue posible calcular costo unitario");
      expect(await db.facturaCompra.count({ where: { ownerId: data.owner.id } })).toBe(0);
      expect(await db.compraInsumo.count({ where: { insumoId: data.insumo.id } })).toBe(0);
      expect(await db.inventarioInsumo.findUnique({ where: { insumoId: data.insumo.id } })).toBeNull();
    } finally {
      await cleanup([data.owner.id, data.other.id]);
    }
  });
});

afterAll(async () => {
  await db.$disconnect();
});
