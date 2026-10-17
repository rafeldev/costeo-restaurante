import "dotenv/config";
import { CategoriaInsumo, CategoriaReceta, UnidadBase } from "@prisma/client";
import bcrypt from "bcryptjs";
import { db } from "../lib/db";
import { getNextReadableCode } from "../lib/readable-code";

function areaParaCategoria(categoria: CategoriaInsumo) {
  if (categoria === CategoriaInsumo.BEBIDAS_LICORES) return "Barra";
  if (
    categoria === CategoriaInsumo.ABARROTES_SECOS ||
    categoria === CategoriaInsumo.EMPAQUES_DESECHABLES
  ) return "Bodega Seca";
  return "Cámara Fría";
}

async function main() {
  if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") {
    throw new Error("El seed de demostración no puede ejecutarse en producción");
  }
  if (!process.env.SEED_OWNER_EMAIL || !process.env.SEED_OWNER_PASSWORD) {
    throw new Error("SEED_OWNER_EMAIL y SEED_OWNER_PASSWORD son obligatorias");
  }
  const ownerEmail = process.env.SEED_OWNER_EMAIL.toLowerCase();
  const ownerPassword = process.env.SEED_OWNER_PASSWORD;
  if (ownerPassword.length < 12) throw new Error("SEED_OWNER_PASSWORD debe tener al menos 12 caracteres");
  const ownerPasswordHash = await bcrypt.hash(ownerPassword, 12);
  const owner = await db.user.upsert({
    where: { email: ownerEmail },
    update: {
      passwordHash: ownerPasswordHash,
    },
    create: {
      email: ownerEmail,
      passwordHash: ownerPasswordHash,
      restaurantName: process.env.SEED_RESTAURANT_NAME ?? "Restaurante de demostración",
    },
  });

  await db.configuracionCosteo.upsert({
    where: { ownerId: owner.id },
    update: {},
    create: {
      ownerId: owner.id,
      overheadPct: 12,
      margenObjetivoPct: 56.2,
      regimenTributario: "IMPOCONSUMO_8",
      impuestoPct: 8,
      redondeoPrecio: 100,
      foodCostCriticoPct: 35,
      margenMinimoPct: 40,
      alertaVolatilidadActiva: true,
      umbralVolatilidadPct: 15,
      toleranciaInventarioPct: 2,
      criticoInventarioPct: 5,
    },
  });

  const areasBase = ["Cámara Fría", "Bodega Seca", "Barra", "Cocina Caliente"];
  for (const [index, nombre] of areasBase.entries()) {
    await db.areaAlmacen.upsert({
      where: { ownerId_nombre: { ownerId: owner.id, nombre } },
      create: { ownerId: owner.id, nombre, orden: index + 1 },
      update: { orden: index + 1 },
    });
  }

  const proveedoresBase = [
    { codigo: "PROV-001", nombre: "Proveedor local", contacto: "proveedorlocal@example.com" },
    { codigo: "PROV-002", nombre: "Carnicería del barrio", contacto: "carniceria@example.com" },
    { codigo: "PROV-003", nombre: "Distribuidor lácteos", contacto: "lacteos@example.com" },
    { codigo: "PROV-004", nombre: "Empaques SAS", contacto: "empaques@example.com" },
    { codigo: "PROV-005", nombre: "Producción propia", contacto: null },
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
      update: { codigo: proveedor.codigo, contacto: proveedor.contacto, activo: true },
    });
  }

  const insumosBase = [
    {
      nombre: "Pan brioche",
      codigo: "INS-001",
      categoria: CategoriaInsumo.ABARROTES_SECOS,
      unidadBase: UnidadBase.UNIDAD,
      costoUnidad: 1200,
      mermaPct: 0,
      proveedor: "Proveedor local",
    },
    {
      nombre: "Carne de res molida",
      codigo: "INS-002",
      categoria: CategoriaInsumo.PROTEINAS_CARNES,
      unidadBase: UnidadBase.GRAMO,
      costoUnidad: 0.028,
      mermaPct: 12,
      proveedor: "Carnicería del barrio",
    },
    {
      nombre: "Queso cheddar",
      codigo: "INS-003",
      categoria: CategoriaInsumo.LACTEOS_QUESOS,
      unidadBase: UnidadBase.GRAMO,
      costoUnidad: 0.031,
      mermaPct: 2,
      proveedor: "Distribuidor lácteos",
    },
    {
      nombre: "Salsa especial",
      codigo: "INS-004",
      categoria: CategoriaInsumo.ABARROTES_SECOS,
      unidadBase: UnidadBase.GRAMO,
      costoUnidad: 0.014,
      mermaPct: 3,
      proveedor: "Producción propia",
    },
    {
      nombre: "Caja para hamburguesa",
      codigo: "INS-005",
      categoria: CategoriaInsumo.EMPAQUES_DESECHABLES,
      unidadBase: UnidadBase.UNIDAD,
      costoUnidad: 450,
      mermaPct: 0,
      proveedor: "Empaques SAS",
    },
  ];

  for (const insumo of insumosBase) {
    const proveedorPreferido = await db.proveedor.findUniqueOrThrow({
      where: {
        ownerId_nombre: {
          ownerId: owner.id,
          nombre: insumo.proveedor,
        },
      },
    });
    const areaNombre = areaParaCategoria(insumo.categoria);
    const area = await db.areaAlmacen.findUniqueOrThrow({
      where: { ownerId_nombre: { ownerId: owner.id, nombre: areaNombre } },
    });
    const insumoData = {
      codigo: insumo.codigo,
      nombre: insumo.nombre,
      categoria: insumo.categoria,
      unidadBase: insumo.unidadBase,
      costoUnidad: insumo.costoUnidad,
      mermaPct: insumo.mermaPct,
    };
    const upserted = await db.insumo.upsert({
      where: {
        ownerId_nombre: {
          ownerId: owner.id,
          nombre: insumo.nombre,
        },
      },
      create: {
        ownerId: owner.id,
        sku: insumo.codigo,
        areaId: area.id,
        ...insumoData,
        proveedorPreferidoId: proveedorPreferido.id,
        activo: true,
      },
      update: {
        codigo: insumoData.codigo,
        sku: insumoData.codigo,
        areaId: area.id,
        categoria: insumoData.categoria,
        unidadBase: insumoData.unidadBase,
        costoUnidad: insumoData.costoUnidad,
        mermaPct: insumoData.mermaPct,
        proveedorPreferidoId: proveedorPreferido.id,
        activo: true,
      },
    });

    await db.inventarioInsumo.upsert({
      where: { insumoId: upserted.id },
      create: { insumoId: upserted.id, stockActual: 0, stockMinimo: 0 },
      update: {},
    });
  }

  const ingredientesHamburguesa = await db.insumo.findMany({
    where: { ownerId: owner.id, codigo: { in: ["INS-001", "INS-002", "INS-003", "INS-004", "INS-005"] } },
    select: { id: true, codigo: true },
  });
  const cantidades: Record<string, number> = {
    "INS-001": 1,
    "INS-002": 180,
    "INS-003": 30,
    "INS-004": 20,
    "INS-005": 1,
  };
  const existingRecipe = await db.receta.findFirst({
    where: { ownerId: owner.id, nombre: "Hamburguesa de la casa" },
    select: { id: true },
  });
  const recipeData = {
    nombre: "Hamburguesa de la casa",
    categoria: CategoriaReceta.HAMBURGUESAS,
    rendimientoPorciones: 1,
    tiempoPreparacionMin: 18,
    precioVentaActual: 22000,
    borrador: false,
    activa: true,
  };
  if (existingRecipe) {
    await db.$transaction([
      db.recetaInsumo.deleteMany({ where: { recetaId: existingRecipe.id } }),
      db.receta.update({
        where: { id: existingRecipe.id },
        data: {
          ...recipeData,
          ingredientes: {
            create: ingredientesHamburguesa.map((item) => ({
              insumoId: item.id,
              cantidad: cantidades[item.codigo]!,
            })),
          },
        },
      }),
    ]);
  } else {
    const existingCodes = await db.receta.findMany({
      where: { ownerId: owner.id },
      select: { codigo: true },
    });
    await db.receta.create({
      data: {
        ownerId: owner.id,
        codigo: getNextReadableCode(existingCodes.map((item) => item.codigo), "RC"),
        ...recipeData,
        ingredientes: {
          create: ingredientesHamburguesa.map((item) => ({
            insumoId: item.id,
            cantidad: cantidades[item.codigo]!,
          })),
        },
      },
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
