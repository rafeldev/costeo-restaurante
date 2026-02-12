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
  const costoTotal = input.costoMateriaPrima * (1 + input.overheadPct / 100);
  const costoPorPorcion = costoTotal / input.rendimientoPorciones;
  const precioSugeridoSinImpuesto =
    costoPorPorcion * (1 + input.margenObjetivoPct / 100);
  const precioSugeridoFinal = roundToStep(
    precioSugeridoSinImpuesto * (1 + input.impuestoPct / 100),
    input.redondeoPrecio,
  );

  const precioActual = input.precioVentaActual ?? null;
  const margenRealPct =
    precioActual && precioActual > 0
      ? ((precioActual - costoPorPorcion) / precioActual) * 100
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
