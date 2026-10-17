import { z } from "zod";
import {
  categoriaInsumoValues,
  categoriaRecetaValues,
  condicionPagoValues,
  motivoVarianzaValues,
  regimenTributarioValues,
  tipoDocumentoCompraValues,
  tipoMovimientoValues,
  unidadBaseValues,
} from "@/lib/domain";

const porcentajeSchema = z.number().min(0).max(100);
const mermaSchema = z.number().min(0).lt(100, "La merma debe ser menor que 100%");
const fechaSchema = z.string().refine((value) => {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnly) {
    const [, year, month, day] = dateOnly;
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    return date.getUTCFullYear() === Number(year) && date.getUTCMonth() === Number(month) - 1 && date.getUTCDate() === Number(day);
  }
  return !Number.isNaN(new Date(value).getTime());
}, "La fecha no es válida");

export const onboardingOutcomeSchema = z.object({
  outcome: z.enum(["completed", "skipped"]),
}).strict();

const insumoObjectSchema = z.object({
  nombre: z.string().trim().min(2).max(120),
  categoria: z.enum(categoriaInsumoValues),
  unidadBase: z.enum(unidadBaseValues),
  costoUnidad: z.number().positive(),
  mermaPct: mermaSchema,
  presentacionCantidad: z.number().positive().optional().nullable(),
  presentacionUnidad: z.enum(unidadBaseValues).optional().nullable(),
  precioPresentacion: z.number().positive().optional().nullable(),
  proveedorPreferidoId: z.string().optional().nullable().or(z.literal("")),
  activo: z.boolean(),
});

function validateInsumoPresentation(
  value: {
    presentacionCantidad?: number | null;
    presentacionUnidad?: (typeof unidadBaseValues)[number] | null;
    precioPresentacion?: number | null;
  },
  context: z.RefinementCtx,
) {
  const presentation = [
    value.presentacionCantidad,
    value.presentacionUnidad,
    value.precioPresentacion,
  ];
  const supplied = presentation.filter((item) => item !== null && item !== undefined).length;
  if (supplied > 0 && supplied < presentation.length) {
    context.addIssue({
      code: "custom",
      path: ["presentacionCantidad"],
      message: "Completa cantidad, unidad y precio de la presentación",
    });
  }
}

export const insumoSchema = insumoObjectSchema
  .extend({
    mermaPct: mermaSchema.default(0),
    activo: z.boolean().default(true),
  })
  .superRefine(validateInsumoPresentation);
export const insumoPatchSchema = insumoObjectSchema.partial().superRefine(validateInsumoPresentation);

export const insumosQuerySchema = z.object({
  categoria: z.enum(categoriaInsumoValues).optional(),
  proveedorId: z.string().trim().min(1).optional(),
});

export const recetaIngredienteSchema = z.object({
  insumoId: z.string().min(1),
  cantidad: z.number().positive(),
});

export const recetaSchema = z.object({
  nombre: z.string().trim().min(2).max(120),
  categoria: z.enum(categoriaRecetaValues),
  rendimientoPorciones: z.number().int().positive(),
  tiempoPreparacionMin: z.number().int().positive().optional(),
  precioVentaActual: z.number().positive().optional(),
  borrador: z.boolean().default(false),
  activa: z.boolean().default(true),
  ingredientes: z.array(recetaIngredienteSchema).min(1),
});

export const recetasQuerySchema = z.object({
  categoria: z.enum(categoriaRecetaValues).optional(),
  estado: z.enum(["rentable", "ajustar", "riesgo"]).optional(),
  insumoId: z.string().min(1).optional(),
});

const configuracionCosteoObjectSchema = z.object({
    overheadPct: z.number().min(5).max(30),
    margenObjetivoPct: porcentajeSchema,
    regimenTributario: z.enum(regimenTributarioValues),
    redondeoPrecio: z.union([z.literal(100), z.literal(50), z.literal(1000), z.literal(0)]),
    foodCostCriticoPct: porcentajeSchema,
    margenMinimoPct: porcentajeSchema,
    alertaVolatilidadActiva: z.boolean(),
    umbralVolatilidadPct: z.number().positive().max(100),
    toleranciaInventarioPct: porcentajeSchema,
    criticoInventarioPct: porcentajeSchema,
  });

export const configuracionCosteoSchema = configuracionCosteoObjectSchema
  .refine((value) => value.overheadPct + value.margenObjetivoPct < 100, {
    message: "La suma de overhead y margen debe ser menor que 100%",
    path: ["margenObjetivoPct"],
  })
  .refine((value) => value.toleranciaInventarioPct < value.criticoInventarioPct, {
    message: "El umbral crítico debe superar la tolerancia de inventario",
    path: ["criticoInventarioPct"],
  });

export const configuracionCosteoPatchSchema = configuracionCosteoObjectSchema
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, "Envía al menos un campo para actualizar");

export const auditoriaConfiguracionQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const proveedorSchema = z.object({
  nombre: z.string().trim().min(2).max(120),
  contacto: z.string().trim().max(120).optional().or(z.literal("")),
  activo: z.boolean().default(true),
});

export const compraInsumoSchema = z.object({
  insumoId: z.string().min(1),
  proveedorId: z.string().optional().nullable(),
  fechaCompra: fechaSchema.optional(),
  cantidadCompra: z.number().positive(),
  unidadCompra: z.enum(unidadBaseValues),
  precioTotal: z.number().positive(),
});

export const facturaCompraLineaSchema = z.object({
  insumoId: z.string().min(1),
  cantidad: z.number().positive(),
  unidad: z.enum(unidadBaseValues),
  precioUnitarioBruto: z.number().positive(),
  tasaImpuestoPct: z.union([z.literal(0), z.literal(5), z.literal(19)]),
});

export const facturaCompraSchema = z.object({
  proveedorId: z.string().min(1),
  tipo: z.enum(tipoDocumentoCompraValues),
  numero: z.string().trim().min(1).max(80),
  fechaEmision: fechaSchema,
  condicionPago: z.enum(condicionPagoValues),
  actualizaCostos: z.boolean().default(true),
  aplicar: z.boolean().default(false),
  lineas: z.array(facturaCompraLineaSchema).min(1).max(100),
});

export const facturaCompraPatchSchema = facturaCompraSchema.omit({ aplicar: true });

export const inventarioPatchSchema = z.object({
  stockMinimo: z.number().min(0),
  areaId: z.string().min(1).nullable().optional(),
});

export const movimientoInventarioSchema = z.object({
  insumoId: z.string().min(1),
  tipo: z.enum(tipoMovimientoValues),
  cantidad: z.number().refine((value) => value !== 0, "La cantidad no puede ser cero"),
  motivo: z.string().trim().min(2).max(200),
  fechaMovimiento: fechaSchema.optional(),
}).superRefine((value, context) => {
  if (value.tipo !== "AJUSTE" && value.cantidad <= 0) {
    context.addIssue({ code: "custom", path: ["cantidad"], message: "La cantidad debe ser positiva" });
  }
});

export const producirRecetaSchema = z.object({
  unidades: z.number().int().positive(),
  fechaProduccion: fechaSchema.optional(),
});

export const areaAlmacenSchema = z.object({
  nombre: z.string().trim().min(2).max(80),
  orden: z.number().int().min(0).max(1000).default(0),
});

export const areaAlmacenPatchSchema = areaAlmacenSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "Envía al menos un campo para actualizar",
);

export const abrirTomaInventarioSchema = z.object({
  periodo: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "El periodo debe tener formato AAAA-MM"),
  observaciones: z.string().trim().max(1000).optional().nullable(),
});

export const conteoInsumoPatchSchema = z.object({
  conteos: z.array(z.object({
    id: z.string().min(1),
    stockFisico: z.number().min(0).nullable(),
    motivo: z.enum(motivoVarianzaValues).optional().nullable(),
    nota: z.string().trim().max(500).optional().nullable(),
  })).max(100),
  observaciones: z.string().trim().max(1000).optional().nullable(),
});

export function parseNumberInput(value: unknown): number | undefined {
  if (value === "" || value === null || value === undefined) {
    return undefined;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value === "string") {
    const parsed = Number(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}
