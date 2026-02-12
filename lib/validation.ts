import { z } from "zod";
import { unidadBaseValues } from "@/lib/domain";

const porcentajeSchema = z.number().min(0).max(100);

export const insumoSchema = z.object({
  nombre: z.string().trim().min(2).max(120),
  categoria: z.string().trim().min(2).max(80),
  unidadBase: z.enum(unidadBaseValues),
  costoUnidad: z.number().positive(),
  mermaPct: porcentajeSchema.default(0),
  proveedor: z.string().trim().max(120).optional().or(z.literal("")),
});

export const recetaIngredienteSchema = z.object({
  insumoId: z.string().min(1),
  cantidad: z.number().positive(),
});

export const recetaSchema = z.object({
  nombre: z.string().trim().min(2).max(120),
  tipoProducto: z.string().trim().min(2).max(80),
  rendimientoPorciones: z.number().int().positive(),
  tiempoPreparacionMin: z.number().int().positive().optional(),
  precioVentaActual: z.number().positive().optional(),
  ingredientes: z.array(recetaIngredienteSchema).min(1),
});

export const configuracionCosteoSchema = z.object({
  overheadPct: porcentajeSchema,
  margenObjetivoPct: porcentajeSchema,
  impuestoPct: porcentajeSchema,
  redondeoPrecio: z.number().positive(),
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
