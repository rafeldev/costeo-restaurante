export type InsumoDTO = {
  id: string;
  nombre: string;
  categoria: string;
  unidadBase: "GRAMO" | "KILOGRAMO" | "MILILITRO" | "LITRO" | "UNIDAD";
  costoUnidad: number;
  mermaPct: number;
  proveedor: string | null;
  inventario?: {
    stockActual: number;
    stockMinimo: number;
    estadoReposicion: "verde" | "amarillo" | "rojo";
  } | null;
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

export type ProveedorDTO = {
  id: string;
  nombre: string;
  contacto: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CompraInsumoDTO = {
  id: string;
  insumoId: string;
  proveedorId: string | null;
  fechaCompra: string;
  cantidadCompra: number;
  unidadCompra: InsumoDTO["unidadBase"];
  precioTotal: number;
  costoUnitarioCalculado: number;
  createdAt: string;
  updatedAt: string;
  insumo?: {
    id: string;
    nombre: string;
    unidadBase: InsumoDTO["unidadBase"];
  };
  proveedor?: {
    id: string;
    nombre: string;
  } | null;
};

export type MovimientoInventarioDTO = {
  id: string;
  insumoId: string;
  tipo: "ENTRADA" | "SALIDA" | "AJUSTE";
  cantidad: number;
  motivo: string | null;
  fechaMovimiento: string;
  createdAt: string;
  updatedAt: string;
  referenciaCompraId: string | null;
  insumo?: {
    id: string;
    nombre: string;
    unidadBase: InsumoDTO["unidadBase"];
  };
};

export type AlertaInventarioDTO = {
  insumoId: string;
  nombre: string;
  stockActual: number;
  stockMinimo: number;
  estadoReposicion: "verde" | "amarillo" | "rojo";
};
