import "dotenv/config";
import { UnidadBase } from "@prisma/client";
import bcrypt from "bcryptjs";
import { db } from "../lib/db";

async function main() {
  const ownerEmail = (process.env.SEED_OWNER_EMAIL ?? "owner@example.com").toLowerCase();
  const ownerPassword = process.env.SEED_OWNER_PASSWORD ?? "changeme123";
  const ownerPasswordHash = await bcrypt.hash(ownerPassword, 12);
  const owner = await db.user.upsert({
    where: { email: ownerEmail },
    update: {
      passwordHash: ownerPasswordHash,
    },
    create: {
      email: ownerEmail,
      passwordHash: ownerPasswordHash,
    },
  });

  await db.configuracionCosteo.upsert({
    where: { ownerId: owner.id },
    update: {
      overheadPct: 15,
      margenObjetivoPct: 40,
      impuestoPct: 19,
      redondeoPrecio: 100,
    },
    create: {
      ownerId: owner.id,
      overheadPct: 15,
      margenObjetivoPct: 40,
      impuestoPct: 19,
      redondeoPrecio: 100,
    },
  });

  const proveedoresBase = [
    { nombre: "Proveedor local", contacto: "proveedorlocal@example.com" },
    { nombre: "Carnicería del barrio", contacto: "carniceria@example.com" },
    { nombre: "Distribuidor lácteos", contacto: "lacteos@example.com" },
    { nombre: "Empaques SAS", contacto: "empaques@example.com" },
  ];

  for (const proveedor of proveedoresBase) {
    await db.proveedor.upsert({
      where: {
        ownerId_nombre: {
          ownerId: owner.id,
          nombre: proveedor.nombre,
        },
      },
      create: {
        ownerId: owner.id,
        ...proveedor,
      },
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
    const upserted = await db.insumo.upsert({
      where: {
        ownerId_nombre: {
          ownerId: owner.id,
          nombre: insumo.nombre,
        },
      },
      create: {
        ownerId: owner.id,
        ...insumo,
      },
      update: {
        categoria: insumo.categoria,
        unidadBase: insumo.unidadBase,
        costoUnidad: insumo.costoUnidad,
        mermaPct: insumo.mermaPct,
        proveedor: insumo.proveedor,
      },
    });

    await db.inventarioInsumo.upsert({
      where: { insumoId: upserted.id },
      create: { insumoId: upserted.id, stockActual: 0, stockMinimo: 0 },
      update: {},
    });
  }

  console.info(`Seed listo para usuario: ${ownerEmail}`);
}

main()
  .then(async () => {
    await db.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await db.$disconnect();
    process.exit(1);
  });
