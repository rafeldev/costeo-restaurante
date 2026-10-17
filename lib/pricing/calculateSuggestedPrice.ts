export type PricingInput = {
  costoMateriaPrima: number;
  rendimientoPorciones: number;
  overheadPct: number;
  margenObjetivoPct: number;
  impuestoPct: number;
  redondeoPrecio: number;
  precioVentaActual?: number | null;
};

export type PricingOutput = {
  costoTotal: number;
  costoPorPorcion: number;
  precioSugeridoSinImpuesto: number;
  precioSugeridoFinal: number;
  margenRealPct: number | null;
  semaforoRentabilidad: "verde" | "amarillo" | "rojo" | "sin_precio";
};

function roundToStep(value: number, step: number): number {
  if (step <= 0) return value;
  return Math.round(value / step) * step;
}

export function calculateSuggestedPrice(input: PricingInput): PricingOutput {
  if (input.rendimientoPorciones <= 0) {
    throw new RangeError("El rendimiento debe ser mayor que cero");
  }

  const denominator = 1 - input.overheadPct / 100 - input.margenObjetivoPct / 100;
  if (denominator <= 0) {
    throw new RangeError("La suma de overhead y margen debe ser menor que 100%");
  }

  const costoTotal = input.costoMateriaPrima * (1 + input.overheadPct / 100);
  const costoPorPorcion = input.costoMateriaPrima / input.rendimientoPorciones;
  const precioSugeridoSinImpuesto =
    costoPorPorcion / denominator;
  const precioSugeridoFinal = roundToStep(
    precioSugeridoSinImpuesto * (1 + input.impuestoPct / 100),
    input.redondeoPrecio,
  );

  const precioActual = input.precioVentaActual ?? null;
  const precioActualSinImpuesto =
    precioActual && precioActual > 0
      ? precioActual / (1 + input.impuestoPct / 100)
      : null;
  const margenRealPct =
    precioActualSinImpuesto
      ? ((precioActualSinImpuesto - costoPorPorcion) / precioActualSinImpuesto) * 100 -
        input.overheadPct
      : null;

  let semaforoRentabilidad: PricingOutput["semaforoRentabilidad"] = "sin_precio";
  if (margenRealPct !== null) {
    if (margenRealPct >= input.margenObjetivoPct) {
      semaforoRentabilidad = "verde";
    } else if (margenRealPct >= input.margenObjetivoPct * 0.8) {
      semaforoRentabilidad = "amarillo";
    } else {
      semaforoRentabilidad = "rojo";
    }
  }

  return {
    costoTotal,
    costoPorPorcion,
    precioSugeridoSinImpuesto,
    precioSugeridoFinal,
    margenRealPct,
    semaforoRentabilidad,
  };
}
