import type { UnidadBaseValue } from "@/lib/domain";

const massUnits: UnidadBaseValue[] = ["GRAMO", "KILOGRAMO"];
const volumeUnits: UnidadBaseValue[] = ["MILILITRO", "LITRO"];

const factorToBase: Record<UnidadBaseValue, number> = {
  GRAMO: 1,
  KILOGRAMO: 1000,
  MILILITRO: 1,
  LITRO: 1000,
  UNIDAD: 1,
};

function unitGroup(unit: UnidadBaseValue): "mass" | "volume" | "count" {
  if (massUnits.includes(unit)) return "mass";
  if (volumeUnits.includes(unit)) return "volume";
  return "count";
}

export function convertQuantity(
  quantity: number,
  from: UnidadBaseValue,
  to: UnidadBaseValue,
): number | null {
  if (!Number.isFinite(quantity) || quantity <= 0) return null;
  if (unitGroup(from) !== unitGroup(to)) return null;

  if (from === to) return quantity;

  const baseQuantity = quantity * factorToBase[from];
  return baseQuantity / factorToBase[to];
}

export function calculateUnitCostFromPurchase(params: {
  precioCompra: number;
  cantidadCompra: number;
  unidadCompra: UnidadBaseValue;
  unidadBase: UnidadBaseValue;
}): number | null {
  const converted = convertQuantity(
    params.cantidadCompra,
    params.unidadCompra,
    params.unidadBase,
  );

  if (!converted || converted <= 0) return null;
  if (!Number.isFinite(params.precioCompra) || params.precioCompra <= 0) return null;

  return params.precioCompra / converted;
}
