import { PrismaClient, UnidadBase } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const config = await prisma.configuracionCosteo.findFirst();
  if (!config) {
    await prisma.configuracionCosteo.create({
      data: {
        overheadPct: 15,
        margenObjetivoPct: 40,
        impuestoPct: 19,
        redondeoPrecio: 100,
      },
    });
  }

  const proveedoresBase = [
    { nombre: "Proveedor local", contacto: "proveedorlocal@example.com" },
    { nombre: "Carnicería del barrio", contacto: "carniceria@example.com" },
    { nombre: "Distribuidor lácteos", contacto: "lacteos@example.com" },
    { nombre: "Empaques SAS", contacto: "empaques@example.com" },
  ];

  for (const proveedor of proveedoresBase) {
    await prisma.proveedor.upsert({
      where: { nombre: proveedor.nombre },
      create: proveedor,
      update: { contacto: proveedor.contacto },
    });
  }

  const insumosBase = [
    {
      nombre: "Pan brioche",
      categoria: "Panadería",
      unidadBase: UnidadBase.UNIDAD,
      costoUnidad: 1200,
      mermaPct: 0,
      proveedor: "Proveedor local",
    },
    {
      nombre: "Carne de res molida",
      categoria: "Proteínas",
      unidadBase: UnidadBase.GRAMO,
      costoUnidad: 0.028,
      mermaPct: 12,
      proveedor: "Carnicería del barrio",
    },
    {
      nombre: "Queso cheddar",
      categoria: "Lácteos",
      unidadBase: UnidadBase.GRAMO,
      costoUnidad: 0.031,
      mermaPct: 2,
      proveedor: "Distribuidor lácteos",
    },
    {
      nombre: "Salsa especial",
      categoria: "Salsas",
      unidadBase: UnidadBase.GRAMO,
      costoUnidad: 0.014,
      mermaPct: 3,
      proveedor: "Producción propia",
    },
    {
      nombre: "Caja para hamburguesa",
      categoria: "Empaque",
      unidadBase: UnidadBase.UNIDAD,
      costoUnidad: 450,
      mermaPct: 0,
      proveedor: "Empaques SAS",
    },
  ];

  for (const insumo of insumosBase) {
    const upserted = await prisma.insumo.upsert({
      where: { nombre: insumo.nombre },
      create: insumo,
      update: {
        categoria: insumo.categoria,
        unidadBase: insumo.unidadBase,
        costoUnidad: insumo.costoUnidad,
        mermaPct: insumo.mermaPct,
        proveedor: insumo.proveedor,
      },
    });

    await prisma.inventarioInsumo.upsert({
      where: { insumoId: upserted.id },
      create: { insumoId: upserted.id, stockActual: 0, stockMinimo: 0 },
      update: {},
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
