export const INVENTORY_TOLERANCE_DEFAULT = 2;
export const INVENTORY_CRITICAL_DEFAULT = 5;

export function calcularDiferencia(stockTeorico: number, stockFisico: number | null) {
  return stockFisico === null ? null : Number((stockFisico - stockTeorico).toFixed(4));
}

export function calcularVarianzaPct(stockTeorico: number, stockFisico: number | null) {
  const diferencia = calcularDiferencia(stockTeorico, stockFisico);
  if (diferencia === null) return null;
  if (stockTeorico === 0) return diferencia === 0 ? 0 : diferencia > 0 ? Infinity : -Infinity;
  return Number(((diferencia / stockTeorico) * 100).toFixed(2));
}

export function getEstadoConteo(
  stockTeorico: number,
  stockFisico: number | null,
  toleranciaPct = INVENTORY_TOLERANCE_DEFAULT,
  criticoPct = INVENTORY_CRITICAL_DEFAULT,
) {
  const varianzaPct = calcularVarianzaPct(stockTeorico, stockFisico);
  if (varianzaPct === null) return "PENDIENTE" as const;
  const absoluta = Math.abs(varianzaPct);
  if (absoluta >= criticoPct) return "CRITICO" as const;
  if (absoluta <= toleranciaPct) return "TOLERANCIA" as const;
  return "DISCREPANCIA" as const;
}
