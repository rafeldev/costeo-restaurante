import type { CategoriaInsumo, UnidadBase } from "@prisma/client";
import { decimalToNumber } from "@/lib/serializers";
import { getEstadoReposicion } from "@/lib/inventory-rules";
import { calculateWasteCost, calculateYieldPct } from "@/lib/unit-conversion";

type DecimalLike = { toNumber: () => number };

export type SerializableInsumo = {
  id: string;
  codigo: string;
  nombre: string;
  categoria: CategoriaInsumo;
  unidadBase: UnidadBase;
  costoUnidad: DecimalLike;
  mermaPct: DecimalLike;
  presentacionCantidad: DecimalLike | null;
  presentacionUnidad: UnidadBase | null;
  precioPresentacion: DecimalLike | null;
  activo: boolean;
  proveedorPreferidoId: string | null;
  proveedorPreferido?: { id: string; codigo: string; nombre: string } | null;
  areaId?: string | null;
  area?: { id: string; nombre: string; orden: number } | null;
  inventario?: { stockActual: DecimalLike; stockMinimo: DecimalLike } | null;
  _count?: { recetaInsumos: number };
  createdAt: Date;
  updatedAt: Date;
};

export function serializeInsumo(insumo: SerializableInsumo) {
  const costoUnidad = decimalToNumber(insumo.costoUnidad) ?? 0;
  const mermaPct = decimalToNumber(insumo.mermaPct) ?? 0;
  const stockActual = decimalToNumber(insumo.inventario?.stockActual ?? null);
  const stockMinimo = decimalToNumber(insumo.inventario?.stockMinimo ?? null);
  const recetasVinculadas = insumo._count?.recetaInsumos ?? 0;

  return {
    id: insumo.id,
    codigo: insumo.codigo,
    nombre: insumo.nombre,
    categoria: insumo.categoria,
    unidadBase: insumo.unidadBase,
    costoUnidad,
    mermaPct,
    rendimientoPct: calculateYieldPct(mermaPct),
    costoNetoReal: calculateWasteCost(costoUnidad, mermaPct),
    presentacionCantidad: decimalToNumber(insumo.presentacionCantidad),
    presentacionUnidad: insumo.presentacionUnidad,
    precioPresentacion: decimalToNumber(insumo.precioPresentacion),
    activo: insumo.activo,
    proveedorPreferidoId: insumo.proveedorPreferidoId,
    proveedorPreferido: insumo.proveedorPreferido ?? null,
    areaId: insumo.areaId ?? null,
    area: insumo.area ?? null,
    recetasCount: recetasVinculadas,
    recetasVinculadas,
    inventario:
      stockActual === null || stockMinimo === null
        ? null
        : {
            stockActual,
            stockMinimo,
            estadoReposicion: getEstadoReposicion(stockActual, stockMinimo),
          },
    createdAt: insumo.createdAt,
    updatedAt: insumo.updatedAt,
  };
}
