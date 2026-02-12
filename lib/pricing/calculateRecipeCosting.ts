import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { CosteoResultado } from "@/lib/domain";
import { calculateSuggestedPrice } from "@/lib/pricing/calculateSuggestedPrice";

function decimalToNumber(value: Prisma.Decimal | number): number {
  if (typeof value === "number") return value;
  return value.toNumber();
}

export async function calculateRecipeCosting(recetaId: string): Promise<CosteoResultado> {
  const [receta, config] = await Promise.all([
    db.receta.findUnique({
      where: { id: recetaId },
      include: {
        ingredientes: {
          include: { insumo: true },
          orderBy: { createdAt: "asc" },
        },
      },
    }),
    db.configuracionCosteo.findFirst({
      orderBy: { createdAt: "asc" },
    }),
  ]);

  if (!receta) {
    throw new Error("Receta no encontrada");
  }
  if (!config) {
    throw new Error("Configuración de costeo no encontrada");
  }

  const desgloseIngredientes = receta.ingredientes.map((item) => {
    const cantidad = decimalToNumber(item.cantidad);
    const costoUnitario = decimalToNumber(item.insumo.costoUnidad);
    const mermaPct = decimalToNumber(item.insumo.mermaPct);
    const factorMerma = 1 + mermaPct / 100;
    const costoAplicado = cantidad * costoUnitario * factorMerma;

    return {
      insumoId: item.insumoId,
      nombre: item.insumo.nombre,
      cantidad,
      costoUnitario,
      mermaPct,
      costoAplicado,
    };
  });

  const costoMateriaPrima = desgloseIngredientes.reduce(
    (acc, item) => acc + item.costoAplicado,
    0,
  );

  const pricing = calculateSuggestedPrice({
    costoMateriaPrima,
    rendimientoPorciones: receta.rendimientoPorciones,
    overheadPct: decimalToNumber(config.overheadPct),
    margenObjetivoPct: decimalToNumber(config.margenObjetivoPct),
    impuestoPct: decimalToNumber(config.impuestoPct),
    redondeoPrecio: decimalToNumber(config.redondeoPrecio),
    precioVentaActual: receta.precioVentaActual
      ? decimalToNumber(receta.precioVentaActual)
      : null,
  });

  return {
    costoMateriaPrima,
    costoTotal: pricing.costoTotal,
    costoPorPorcion: pricing.costoPorPorcion,
    precioSugeridoSinImpuesto: pricing.precioSugeridoSinImpuesto,
    precioSugeridoFinal: pricing.precioSugeridoFinal,
    margenRealPct: pricing.margenRealPct,
    semaforoRentabilidad: pricing.semaforoRentabilidad,
    desgloseIngredientes,
  };
}
