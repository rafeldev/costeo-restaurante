import type {
  CategoriaInsumoValue,
  CategoriaRecetaValue,
  MotivoVarianzaValue,
  RegimenTributarioValue,
  UnidadBaseValue,
} from "@/lib/domain";

export type InsumoDTO = {
  id: string;
  codigo: string;
  nombre: string;
  categoria: CategoriaInsumoValue;
  unidadBase: UnidadBaseValue;
  costoUnidad: number;
  mermaPct: number;
  rendimientoPct: number;
  costoNetoReal: number;
  presentacionCantidad: number | null;
  presentacionUnidad: UnidadBaseValue | null;
  precioPresentacion: number | null;
  activo: boolean;
  proveedorPreferidoId: string | null;
  proveedorPreferido?: {
    id: string;
    nombre: string;
  } | null;
  areaId?: string | null;
  area?: { id: string; nombre: string; orden: number } | null;
  recetasCount?: number;
  recetasVinculadas: number;
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
  codigo: string;
  nombre: string;
  categoria: CategoriaRecetaValue;
  rendimientoPorciones: number;
  tiempoPreparacionMin: number | null;
  precioVentaActual: number | null;
  borrador: boolean;
  activa: boolean;
  createdAt: string;
  updatedAt: string;
  ingredientes?: RecetaIngredienteDTO[];
};

export type EstadoRentabilidadDTO = "Rentable" | "Ajustar" | "Riesgo" | "Sin dato";

export type RecetaCatalogoDTO = RecetaDTO & {
  costoPorcion: number;
  pvpCarta: number | null;
  pvpSugerido: number;
  foodCostPct: number | null;
  margenContribucionPct: number | null;
  estado: EstadoRentabilidadDTO;
  nInsumos: number;
};

export type RecetasResumenDTO = {
  activas: number;
  foodCostPromedio: number | null;
  margenContribucionPromedio: number | null;
  requierenRevision: number;
};

export type ConfigCosteoDTO = {
  id: string;
  overheadPct: number;
  margenObjetivoPct: number;
  regimenTributario: RegimenTributarioValue;
  impuestoPct: number;
  redondeoPrecio: number;
  foodCostCriticoPct: number;
  margenMinimoPct: number;
  alertaVolatilidadActiva: boolean;
  umbralVolatilidadPct: number;
  toleranciaInventarioPct: number;
  criticoInventarioPct: number;
  createdAt: string;
  updatedAt: string;
};

export type ConfiguracionAuditoriaDTO = {
  id: string;
  campo: string;
  valorAnterior: string;
  valorNuevo: string;
  creadoEn: string;
  usuario: { id: string; email: string };
};

export type SimulacionCosteoDTO = {
  receta: { id: string; nombre: string; rendimientoPorciones: number };
  costoMateriaPrima: number;
  costoPorPorcion: number;
  precioSugeridoSinImpuesto: number;
  impuestoPct: number;
  precioSugeridoFinal: number;
};

export type CosteoDTO = {
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

export type ProveedorDTO = {
  id: string;
  codigo: string;
  nombre: string;
  contacto: string | null;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PaginatedResponse<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};

export type InsumosResumenDTO = {
  activos: number;
  mermaPromedioPct: number;
  proveedoresActivos: number;
  proveedoresConVariacion: number;
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

export type FacturaCompraDTO = {
  id: string;
  proveedorId: string;
  tipo: "FAC" | "REM";
  numero: string;
  fechaEmision: string;
  condicionPago: "CONTADO" | "CREDITO_15" | "CREDITO_30";
  fechaVencimiento: string | null;
  estado: "BORRADOR" | "APLICADA";
  actualizaCostos: boolean;
  subtotal: number;
  impuestos: number;
  total: number;
  createdAt: string;
  updatedAt: string;
  proveedor: { id: string; codigo: string; nombre: string };
  lineas: Array<{
    id: string;
    insumoId: string;
    cantidad: number;
    unidad: InsumoDTO["unidadBase"];
    precioUnitarioBruto: number;
    tasaImpuestoPct: number;
    totalLinea: number;
    compraInsumoId: string | null;
    insumo: { id: string; codigo: string; nombre: string; unidadBase: InsumoDTO["unidadBase"] };
  }>;
};

export type ComprasResumenDTO = {
  gasto: number;
  variacionVsMesAnterior: number | null;
  facturas: number;
  proveedores: number;
  alertasVariacion: number;
};

export type VariacionPrecioDTO = {
  insumoId: string;
  codigo: string;
  nombre: string;
  precioAnterior: number;
  precioActual: number;
  variacionPct: number;
  recetasAfectadas: number;
  costoRecetasAntes: number;
  costoRecetasDespues: number;
  fecha: string;
  alerta: boolean;
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
  desviacionPct: number | null;
  estado: "Crítico" | "Reorden" | "Sano";
  proveedorPreferido: { id: string; nombre: string } | null;
};

export type ProduccionDTO = {
  id: string;
  recetaId: string | null;
  recetaNombre: string;
  unidades: number;
  costoTotalProduccion: number;
  estado: "ACTIVA" | "ANULADA";
  fechaProduccion: string;
  createdAt: string;
  updatedAt: string;
};

export type ProduccionResumenDTO = {
  totalProducciones: number;
  totalUnidades: number;
  costoTotalMP: number;
};

export type StockShortageDTO = {
  insumoId: string;
  nombre: string;
  requerido: number;
  disponible: number;
};

export type AreaAlmacenDTO = {
  id: string;
  nombre: string;
  orden: number;
  insumosCount?: number;
};

export type ConteoInventarioDTO = {
  id: string;
  insumoId: string;
  sku: string | null;
  codigo: string;
  nombre: string;
  categoria: CategoriaInsumoValue;
  unidadBase: UnidadBaseValue;
  area: AreaAlmacenDTO | null;
  stockTeorico: number;
  costoUnitario: number;
  stockFisico: number | null;
  diferencia: number | null;
  varianzaPct: number | null;
  impacto: number | null;
  estado: "PENDIENTE" | "TOLERANCIA" | "DISCREPANCIA" | "CRITICO";
  motivo: MotivoVarianzaValue | null;
  nota: string | null;
  contadoPor: string | null;
  contadoEn: string | null;
};

export type TomaInventarioResumenDTO = {
  id: string;
  periodo: string;
  estado: "EN_CURSO" | "CERRADA";
  observaciones: string | null;
  firmadoPor: string | null;
  abiertaEn: string;
  cerradaEn: string | null;
  total: number;
  contados: number;
};

export type TomaInventarioDetalleDTO = TomaInventarioResumenDTO & {
  toleranciaPct: number;
  criticoPct: number;
  kpis: {
    valorInventariado: number;
    varianzaGlobalNeta: number;
    discrepanciasCriticas: number;
    progresoPct: number;
  };
  resumen: { faltantes: number; sobrantes: number; ajusteNeto: number; pendientes: number };
  items: ConteoInventarioDTO[];
  totalFiltrado: number;
  page: number;
  pageSize: number;
};
