import { db } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import { calculateFoodCostPonderado, calculateUmbrales, classifyCuadrante } from "@/lib/menu-engineering";
import { costRecipe, recetaInclude } from "@/lib/receta-service";
import { decimalToNumber } from "@/lib/serializers";
import type { ventasRecetasPatchSchema } from "@/lib/validation";
import type { z } from "zod";

export async function upsertVentasRecetas(
  ownerId: string,
  data: z.output<typeof ventasRecetasPatchSchema>,
) {
  const { periodo, items } = data;
  await db.$transaction(async (tx) => {
    const count = await tx.receta.count({
      where: { ownerId, id: { in: items.map((item) => item.recetaId) } },
    });
    if (count !== items.length) {
      throw new NotFoundError("Una o más recetas no existen o no pertenecen al usuario.");
    }
    for (const item of items) {
      await tx.ventaReceta.upsert({
        where: { ownerId_recetaId_periodo: { ownerId, recetaId: item.recetaId, periodo } },
        create: { ownerId, recetaId: item.recetaId, periodo, unidadesVendidas: item.unidadesVendidas },
        update: { unidadesVendidas: item.unidadesVendidas },
      });
    }
  });
}

export async function getMezclaMenu(ownerId: string, periodo: string) {
  const [recetas, config, ventas] = await Promise.all([
    db.receta.findMany({ where: { ownerId, activa: true, borrador: false }, include: recetaInclude }),
    db.configuracionCosteo.findFirst({ where: { ownerId }, orderBy: { createdAt: "asc" } }),
    db.ventaReceta.findMany({ where: { ownerId, periodo } }),
  ]);
  if (!config) throw new NotFoundError("Configuración de costeo no encontrada.");

  const ventasPorReceta = new Map(ventas.map((venta) => [venta.recetaId, venta]));
  const impuestoPct = decimalToNumber(config.impuestoPct) ?? 0;

  const rows = recetas.map((receta) => {
    const costeo = costRecipe(receta, config);
    const { costoPorcion, pvpCarta, foodCostPct } = costeo;
    const margenUnitario = pvpCarta !== null ? pvpCarta - costoPorcion : null;
    const tieneVentaRegistrada = ventasPorReceta.has(receta.id);
    const unidadesVendidas = ventasPorReceta.get(receta.id)?.unidadesVendidas ?? 0;
    const margenTotal = margenUnitario !== null ? margenUnitario * unidadesVendidas : null;
    const ventaNeta = pvpCarta && pvpCarta > 0 ? pvpCarta / (1 + impuestoPct / 100) : null;
    return {
      recetaId: receta.id,
      codigo: receta.codigo,
      nombre: receta.nombre,
      categoria: receta.categoria,
      unidadesVendidas,
      tieneVentaRegistrada,
      costoPorcion,
      pvpCarta,
      margenUnitario,
      margenTotal,
      foodCostPct,
      ventaNeta,
    };
  });

  const umbrales = calculateUmbrales(
    rows.map((row) => ({
      unidadesVendidas: row.unidadesVendidas,
      margenUnitario: row.margenUnitario,
      tieneVentaRegistrada: row.tieneVentaRegistrada,
    })),
  ) ?? { umbralUnidades: 0, umbralMargen: 0 };

  const items = rows.map((row) => ({
    recetaId: row.recetaId,
    codigo: row.codigo,
    nombre: row.nombre,
    categoria: row.categoria,
    unidadesVendidas: row.unidadesVendidas,
    tieneVentaRegistrada: row.tieneVentaRegistrada,
    costoPorcion: row.costoPorcion,
    pvpCarta: row.pvpCarta,
    margenUnitario: row.margenUnitario,
    margenTotal: row.margenTotal,
    foodCostPct: row.foodCostPct,
    cuadrante: classifyCuadrante({
      unidadesVendidas: row.unidadesVendidas,
      margenUnitario: row.margenUnitario,
      umbralUnidades: umbrales.umbralUnidades,
      umbralMargen: umbrales.umbralMargen,
      tieneVentaRegistrada: row.tieneVentaRegistrada,
    }),
  }));

  const foodCostPonderadoPct = calculateFoodCostPonderado(
    rows.map((row) => ({
      costoPorcion: row.costoPorcion,
      ventaNeta: row.ventaNeta,
      unidadesVendidas: row.unidadesVendidas,
      tieneVentaRegistrada: row.tieneVentaRegistrada,
    })),
  );

  let mayorImpacto: { recetaId: string; nombre: string; margenTotal: number } | null = null;
  for (const item of items) {
    if (!item.tieneVentaRegistrada || item.margenTotal === null) continue;
    if (mayorImpacto === null || item.margenTotal > mayorImpacto.margenTotal) {
      mayorImpacto = { recetaId: item.recetaId, nombre: item.nombre, margenTotal: item.margenTotal };
    }
  }

  const kpis = {
    unidadesVendidas: items.reduce((sum, item) => sum + item.unidadesVendidas, 0),
    foodCostPonderadoPct,
    mayorImpacto,
    sinDato: items.filter((item) => item.cuadrante === "Sin dato").length,
  };

  const totales = {
    unidadesVendidas: kpis.unidadesVendidas,
    margenTotal: items.reduce((sum, item) => sum + (item.margenTotal ?? 0), 0),
  };

  return { periodo, kpis, items, totales };
}
