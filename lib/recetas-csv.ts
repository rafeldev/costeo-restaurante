import { categoriaRecetaValues, type CategoriaRecetaValue } from "@/lib/domain";

export type RecetaCsvRow = {
  fila: number;
  data: {
    nombre: string;
    categoria: CategoriaRecetaValue;
    rendimientoPorciones: number;
    tiempoPreparacionMin?: number;
    precioVentaActual?: number;
    borrador: boolean;
    activa: boolean;
  };
  insumoCodigo: string;
  cantidad: number;
};

export type CsvRowError = { fila: number; motivo: string };

export type RecetaCsvImport = {
  fila: number;
  data: RecetaCsvRow["data"];
  ingredientes: Array<{ insumoCodigo: string; cantidad: number }>;
};

function splitCsvLine(line: string) {
  const values: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]!;
    if (char === '"' && line[index + 1] === '"' && quoted) {
      value += '"';
      index += 1;
    } else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) {
      values.push(value.trim());
      value = "";
    } else value += char;
  }
  values.push(value.trim());
  return values;
}

export function parseRecetasCsv(csv: string) {
  const lines = csv.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (!lines.length) return { rows: [] as RecetaCsvRow[], errores: [{ fila: 1, motivo: "El CSV está vacío" }] };
  const headers = splitCsvLine(lines[0]!).map((header) => header.toLowerCase());
  const required = ["nombre", "categoria", "rendimientoporciones", "insumocodigo", "cantidad"];
  const missing = required.filter((header) => !headers.includes(header));
  if (missing.length) {
    return { rows: [] as RecetaCsvRow[], errores: [{ fila: 1, motivo: `Faltan columnas: ${missing.join(", ")}` }] };
  }
  const rows: RecetaCsvRow[] = [];
  const errores: CsvRowError[] = [];
  for (let index = 1; index < lines.length; index += 1) {
    const fila = index + 1;
    const values = splitCsvLine(lines[index]!);
    const get = (name: string) => values[headers.indexOf(name)]?.trim() ?? "";
    const categoria = get("categoria") as CategoriaRecetaValue;
    const rendimiento = Number(get("rendimientoporciones"));
    const cantidad = Number(get("cantidad").replace(",", "."));
    const tiempo = get("tiempopreparacionmin") ? Number(get("tiempopreparacionmin")) : undefined;
    const pvp = get("pvpcarta") ? Number(get("pvpcarta").replace(",", ".")) : undefined;
    const reasons = [
      !get("nombre") ? "Nombre requerido" : "",
      !categoriaRecetaValues.includes(categoria) ? "Categoría inválida" : "",
      !Number.isInteger(rendimiento) || rendimiento <= 0 ? "Rendimiento inválido" : "",
      !get("insumocodigo") ? "Código de insumo requerido" : "",
      !Number.isFinite(cantidad) || cantidad <= 0 ? "Cantidad inválida" : "",
      tiempo !== undefined && (!Number.isInteger(tiempo) || tiempo <= 0) ? "Tiempo inválido" : "",
      pvp !== undefined && (!Number.isFinite(pvp) || pvp <= 0) ? "PVP inválido" : "",
    ].filter(Boolean);
    if (reasons.length) errores.push({ fila, motivo: reasons.join(". ") });
    else rows.push({
      fila,
      data: {
        nombre: get("nombre"), categoria, rendimientoPorciones: rendimiento,
        tiempoPreparacionMin: tiempo, precioVentaActual: pvp,
        borrador: get("borrador").toLowerCase() === "true", activa: get("activa").toLowerCase() !== "false",
      },
      insumoCodigo: get("insumocodigo"), cantidad,
    });
  }
  return { rows, errores };
}

export function groupRecetasCsv(rows: RecetaCsvRow[]) {
  const recipes = new Map<string, RecetaCsvImport>();
  const invalidRecipes = new Set<string>();
  const errores: CsvRowError[] = [];

  for (const row of rows) {
    const key = row.data.nombre.trim().toLocaleLowerCase("es");
    const existing = recipes.get(key);
    if (!existing) {
      recipes.set(key, {
        fila: row.fila,
        data: row.data,
        ingredientes: [{ insumoCodigo: row.insumoCodigo, cantidad: row.cantidad }],
      });
      continue;
    }

    if (JSON.stringify(existing.data) !== JSON.stringify(row.data)) {
      errores.push({ fila: row.fila, motivo: `Datos inconsistentes para la receta ${row.data.nombre}` });
      invalidRecipes.add(key);
      continue;
    }
    if (existing.ingredientes.some(
      (item) => item.insumoCodigo.toLocaleUpperCase("es") === row.insumoCodigo.toLocaleUpperCase("es"),
    )) {
      errores.push({ fila: row.fila, motivo: `Insumo repetido en la receta ${row.data.nombre}` });
      invalidRecipes.add(key);
      continue;
    }
    existing.ingredientes.push({ insumoCodigo: row.insumoCodigo, cantidad: row.cantidad });
  }

  return {
    recipes: [...recipes.entries()]
      .filter(([key]) => !invalidRecipes.has(key))
      .map(([, recipe]) => recipe),
    errores,
  };
}
