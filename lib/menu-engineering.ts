export type Cuadrante = "Estrella" | "Caballo de Batalla" | "Puzzle" | "Perro" | "Sin dato";

type ClassifyCuadranteInput = {
  unidadesVendidas: number;
  margenUnitario: number | null;
  umbralUnidades: number;
  umbralMargen: number;
  tieneVentaRegistrada: boolean;
};

type UmbralItem = {
  unidadesVendidas: number;
  margenUnitario: number | null;
  tieneVentaRegistrada: boolean;
};

type FoodCostItem = {
  costoPorcion: number;
  ventaNeta: number | null;
  unidadesVendidas: number;
  tieneVentaRegistrada: boolean;
};

const round2 = (value: number) => Math.round(value * 100) / 100;

const average = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;

export function classifyCuadrante({
  unidadesVendidas,
  margenUnitario,
  umbralUnidades,
  umbralMargen,
  tieneVentaRegistrada,
}: ClassifyCuadranteInput): Cuadrante {
  if (!tieneVentaRegistrada || margenUnitario === null) {
    return "Sin dato";
  }

  const popular = unidadesVendidas >= umbralUnidades;
  const rentable = margenUnitario >= umbralMargen;

  if (popular && rentable) return "Estrella";
  if (popular) return "Caballo de Batalla";
  if (rentable) return "Puzzle";
  return "Perro";
}

export function calculateUmbrales(
  items: UmbralItem[],
): { umbralUnidades: number; umbralMargen: number } | null {
  const qualifying = items.filter(
    (item): item is UmbralItem & { margenUnitario: number } =>
      item.tieneVentaRegistrada && item.margenUnitario !== null,
  );

  if (qualifying.length === 0) {
    return null;
  }

  return {
    umbralUnidades: round2(average(qualifying.map((item) => item.unidadesVendidas))),
    umbralMargen: round2(average(qualifying.map((item) => item.margenUnitario))),
  };
}

export function calculateFoodCostPonderado(items: FoodCostItem[]): number | null {
  const qualifying = items.filter(
    (item): item is FoodCostItem & { ventaNeta: number } =>
      item.tieneVentaRegistrada && item.ventaNeta !== null && item.ventaNeta > 0,
  );

  if (qualifying.length === 0) {
    return null;
  }

  const costoTotal = qualifying.reduce((sum, item) => sum + item.costoPorcion * item.unidadesVendidas, 0);
  const ventaTotal = qualifying.reduce((sum, item) => sum + item.ventaNeta * item.unidadesVendidas, 0);

  if (ventaTotal <= 0) {
    return null;
  }

  return round2((costoTotal / ventaTotal) * 100);
}
