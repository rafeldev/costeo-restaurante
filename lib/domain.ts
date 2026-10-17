export const unidadBaseValues = [
  "GRAMO",
  "KILOGRAMO",
  "MILILITRO",
  "LITRO",
  "UNIDAD",
] as const;

export type UnidadBaseValue = (typeof unidadBaseValues)[number];

export const categoriaInsumoValues = [
  "PROTEINAS_CARNES",
  "LACTEOS_QUESOS",
  "FRUTAS_VERDURAS",
  "ABARROTES_SECOS",
  "EMPAQUES_DESECHABLES",
  "BEBIDAS_LICORES",
] as const;

export type CategoriaInsumoValue = (typeof categoriaInsumoValues)[number];

export const categoriaRecetaValues = [
  "HAMBURGUESAS",
  "ENTRADAS_TAPAS",
  "PLATOS_FUERTES",
  "PASTAS_PIZZAS",
  "COCTELERIA_BARRA",
  "POSTRES",
] as const;

export type CategoriaRecetaValue = (typeof categoriaRecetaValues)[number];

export const categoriaRecetaLabels: Record<CategoriaRecetaValue, string> = {
  HAMBURGUESAS: "Hamburguesas",
  ENTRADAS_TAPAS: "Entradas y Tapas",
  PLATOS_FUERTES: "Platos Fuertes",
  PASTAS_PIZZAS: "Pastas y Pizzas",
  COCTELERIA_BARRA: "Coctelería y Barra",
  POSTRES: "Postres",
};

export const categoriaInsumoLabels: Record<CategoriaInsumoValue, string> = {
  PROTEINAS_CARNES: "Proteínas y Carnes",
  LACTEOS_QUESOS: "Lácteos y Quesos",
  FRUTAS_VERDURAS: "Frutas y Verduras",
  ABARROTES_SECOS: "Abarrotes y Secos",
  EMPAQUES_DESECHABLES: "Empaques y Desechables",
  BEBIDAS_LICORES: "Bebidas y Licores",
};

export const tipoMovimientoValues = ["ENTRADA", "SALIDA", "AJUSTE"] as const;
export type TipoMovimientoValue = (typeof tipoMovimientoValues)[number];

export const tipoMovimientoLabels: Record<TipoMovimientoValue, string> = {
  ENTRADA: "Entrada",
  SALIDA: "Salida",
  AJUSTE: "Ajuste",
};

export const tipoDocumentoCompraValues = ["FAC", "REM"] as const;
export type TipoDocumentoCompraValue = (typeof tipoDocumentoCompraValues)[number];

export const condicionPagoValues = ["CONTADO", "CREDITO_15", "CREDITO_30"] as const;
export type CondicionPagoValue = (typeof condicionPagoValues)[number];

export const condicionPagoLabels: Record<CondicionPagoValue, string> = {
  CONTADO: "Contado",
  CREDITO_15: "Crédito a 15 días",
  CREDITO_30: "Crédito a 30 días",
};

export type EstadoReposicion = "verde" | "amarillo" | "rojo";

export const motivoVarianzaValues = [
  "SOBREPORCIONADO",
  "MERMA_EXTRA",
  "VENTA_NO_REGISTRADA",
  "DETERIORO",
  "ERROR_CONTEO",
  "OTRO",
] as const;
export type MotivoVarianzaValue = (typeof motivoVarianzaValues)[number];

export const regimenTributarioValues = ["IMPOCONSUMO_8", "IVA_19", "EXENTO"] as const;
export type RegimenTributarioValue = (typeof regimenTributarioValues)[number];

export const regimenTributarioLabels: Record<RegimenTributarioValue, string> = {
  IMPOCONSUMO_8: "Impoconsumo (8 %)",
  IVA_19: "IVA (19 %)",
  EXENTO: "Exento (0 %)",
};

export const motivoVarianzaLabels: Record<MotivoVarianzaValue, string> = {
  SOBREPORCIONADO: "Sobreporcionado",
  MERMA_EXTRA: "Merma extra",
  VENTA_NO_REGISTRADA: "Venta no registrada",
  DETERIORO: "Deterioro",
  ERROR_CONTEO: "Error de conteo",
  OTRO: "Otro",
};

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
  impuestoPct: number;
  margenRealPct: number | null;
  semaforoRentabilidad: "verde" | "amarillo" | "rojo" | "sin_precio";
  desgloseIngredientes: Array<{
    insumoId: string;
    nombre: string;
    cantidad: number;
    costoUnitario: number;
    costoNetoUnitario: number;
    mermaPct: number;
    costoAplicado: number;
  }>;
};
