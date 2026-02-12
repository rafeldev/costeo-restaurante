export const unidadBaseValues = [
  "GRAMO",
  "KILOGRAMO",
  "MILILITRO",
  "LITRO",
  "UNIDAD",
] as const;

export type UnidadBaseValue = (typeof unidadBaseValues)[number];

export const tipoMovimientoValues = ["ENTRADA", "SALIDA", "AJUSTE"] as const;
export type TipoMovimientoValue = (typeof tipoMovimientoValues)[number];

export const tipoMovimientoLabels: Record<TipoMovimientoValue, string> = {
  ENTRADA: "Entrada",
  SALIDA: "Salida",
  AJUSTE: "Ajuste",
};

export type EstadoReposicion = "verde" | "amarillo" | "rojo";

export const unidadBaseLabels: Record<UnidadBaseValue, string> = {
  GRAMO: "Gramo (g)",
  KILOGRAMO: "Kilogramo (kg)",
  MILILITRO: "Mililitro (ml)",
  LITRO: "Litro (l)",
  UNIDAD: "Unidad",
};

export const unidadBaseShort: Record<UnidadBaseValue, string> = {
  GRAMO: "g",
  KILOGRAMO: "kg",
  MILILITRO: "ml",
  LITRO: "l",
  UNIDAD: "und",
};

export type CosteoResultado = {
  costoMateriaPrima: number;
  costoTotal: number;
  costoPorPorcion: number;
  precioSugeridoSinImpuesto: number;
  precioSugeridoFinal: number;
  margenRealPct: number | null;
  semaforoRentabilidad: "verde" | "amarillo" | "rojo" | "sin_precio";
  desgloseIngredientes: Array<{
    insumoId: string;
    nombre: string;
    cantidad: number;
    costoUnitario: number;
    mermaPct: number;
    costoAplicado: number;
  }>;
};
