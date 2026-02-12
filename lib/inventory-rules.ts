import type { EstadoReposicion, TipoMovimientoValue } from "@/lib/domain";

export function getEstadoReposicion(stockActual: number, stockMinimo: number): EstadoReposicion {
  if (stockActual <= stockMinimo) return "rojo";
  if (stockActual <= stockMinimo * 1.2) return "amarillo";
  return "verde";
}

export function getDeltaFromMovimiento(tipo: TipoMovimientoValue, cantidad: number): number {
  if (tipo === "ENTRADA") return Math.abs(cantidad);
  if (tipo === "SALIDA") return -Math.abs(cantidad);
  return cantidad;
}
