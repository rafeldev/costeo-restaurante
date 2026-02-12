export type InsumoDTO = {
  id: string;
  nombre: string;
  categoria: string;
  unidadBase: "GRAMO" | "KILOGRAMO" | "MILILITRO" | "LITRO" | "UNIDAD";
  costoUnidad: number;
  mermaPct: number;
  proveedor: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RecetaIngredienteDTO = {
  id: string;
  recetaId: string;
  insumoId: string;
  cantidad: number;
  insumo?: {
    id: string;
    nombre: string;
    categoria: string;
  };
};

export type RecetaDTO = {
  id: string;
  nombre: string;
  tipoProducto: string;
  rendimientoPorciones: number;
  tiempoPreparacionMin: number | null;
  precioVentaActual: number | null;
  createdAt: string;
  updatedAt: string;
  ingredientes?: RecetaIngredienteDTO[];
};

export type ConfigCosteoDTO = {
  id: string;
  overheadPct: number;
  margenObjetivoPct: number;
  impuestoPct: number;
  redondeoPrecio: number;
  createdAt: string;
  updatedAt: string;
};

export type CosteoDTO = {
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
