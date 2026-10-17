import { db } from "@/lib/db";
import type { CosteoResultado } from "@/lib/domain";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { calculateSuggestedPrice } from "@/lib/pricing/calculateSuggestedPrice";
import { applyWasteYield } from "@/lib/unit-conversion";

type DecimalLike = { toNumber: () => number };

function decimalToNumber(value: DecimalLike | number): number {
  if (typeof value === "number") return value;
  return value.toNumber();
}

export async function calculateRecipeCosting(
  recetaId: string,
  ownerId: string,
): Promise<CosteoResultado> {
  const [receta, config] = await Promise.all([
    db.receta.findFirst({
      where: { id: recetaId, ownerId },
      include: {
        ingredientes: {
          include: { insumo: true },
          orderBy: { createdAt: "asc" },
        },
      },
    }),
    db.configuracionCosteo.findFirst({
      where: { ownerId },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  if (!receta) {
    throw new NotFoundError("Receta no encontrada");
  }
  if (!config) {
    throw new NotFoundError("Configuración de costeo no encontrada");
  }
  const hasForeignIngredient = receta.ingredientes.some(
    (item) => item.insumo.ownerId !== ownerId,
  );
  if (hasForeignIngredient) {
    throw new ValidationError("Receta con ingredientes fuera del alcance del usuario");
  }

  const desgloseIngredientes = receta.ingredientes.map((item) => {
    const cantidad = decimalToNumber(item.cantidad);
    const costoUnitario = decimalToNumber(item.insumo.costoUnidad);
    const mermaPct = decimalToNumber(item.insumo.mermaPct);
    const costoNetoUnitario = applyWasteYield(1, mermaPct) * costoUnitario;
    const costoAplicado = cantidad * costoNetoUnitario;

    return {
      insumoId: item.insumoId,
      nombre: item.insumo.nombre,
      cantidad,
      costoUnitario,
      costoNetoUnitario,
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
    impuestoPct: decimalToNumber(config.impuestoPct),
    margenRealPct: pricing.margenRealPct,
    semaforoRentabilidad: pricing.semaforoRentabilidad,
    desgloseIngredientes,
  };
}
