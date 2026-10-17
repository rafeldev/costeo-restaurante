import {
  categoriaInsumoLabels,
  categoriaInsumoValues,
  unidadBaseLabels,
  unidadBaseValues,
  type CategoriaInsumoValue,
  type UnidadBaseValue,
} from "@/lib/domain";
import { insumoSchema, parseNumberInput } from "@/lib/validation";

export type CsvInsumoRow = {
  fila: number;
  data: ReturnType<typeof insumoSchema.parse>;
  proveedor: string | null;
};

export type CsvRowError = { fila: number; motivo: string };

function normalize(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("es")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"' && quoted && line[index + 1] === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  if (quoted) throw new Error("Comillas sin cerrar");
  cells.push(current.trim());
  return cells;
}

const categoryAliases = new Map<string, CategoriaInsumoValue>();
for (const value of categoriaInsumoValues) {
  categoryAliases.set(normalize(value), value);
  categoryAliases.set(normalize(categoriaInsumoLabels[value]), value);
}

const unitAliases = new Map<string, UnidadBaseValue>();
for (const value of unidadBaseValues) {
  unitAliases.set(normalize(value), value);
  unitAliases.set(normalize(unidadBaseLabels[value]), value);
}
unitAliases.set("g", "GRAMO");
unitAliases.set("kg", "KILOGRAMO");
unitAliases.set("ml", "MILILITRO");
unitAliases.set("l", "LITRO");
unitAliases.set("und", "UNIDAD");
unitAliases.set("unidad", "UNIDAD");

function parseBoolean(value: string) {
  if (!value) return true;
  if (["si", "sí", "true", "1", "activo"].includes(value.toLocaleLowerCase("es"))) return true;
  if (["no", "false", "0", "inactivo"].includes(value.toLocaleLowerCase("es"))) return false;
  return undefined;
}

export function parseInsumosCsv(csv: string): { rows: CsvInsumoRow[]; errores: CsvRowError[] } {
  const lines = csv.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length === 0) return { rows: [], errores: [{ fila: 1, motivo: "El archivo está vacío" }] };

  let headers: string[];
  try {
    headers = parseCsvLine(lines[0]).map(normalize);
  } catch (error) {
    return { rows: [], errores: [{ fila: 1, motivo: (error as Error).message }] };
  }
  const required = ["nombre", "categoria", "unidadbase", "costounidad"];
  const missing = required.filter((header) => !headers.includes(header));
  if (missing.length > 0) {
    return {
      rows: [],
      errores: [{ fila: 1, motivo: `Faltan columnas obligatorias: ${missing.join(", ")}` }],
    };
  }

  const rows: CsvInsumoRow[] = [];
  const errores: CsvRowError[] = [];
  lines.slice(1).forEach((line, index) => {
    const fila = index + 2;
    try {
      const values = parseCsvLine(line);
      const record = Object.fromEntries(headers.map((header, column) => [header, values[column] ?? ""]));
      const categoria = categoryAliases.get(normalize(record.categoria));
      const unidadBase = unitAliases.get(normalize(record.unidadbase));
      const presentacionUnidad = record.presentacionunidad
        ? unitAliases.get(normalize(record.presentacionunidad))
        : null;
      const activo = parseBoolean(record.activo);
      const parsed = insumoSchema.safeParse({
        nombre: record.nombre,
        categoria,
        unidadBase,
        costoUnidad: parseNumberInput(record.costounidad),
        mermaPct: parseNumberInput(record.mermapct) ?? 0,
        presentacionCantidad: parseNumberInput(record.presentacioncantidad) ?? null,
        presentacionUnidad,
        precioPresentacion: parseNumberInput(record.preciopresentacion) ?? null,
        proveedorPreferidoId: null,
        activo,
      });
      if (!parsed.success) {
        throw new Error(parsed.error.issues.map((issue) => issue.message).join("; "));
      }
      rows.push({ fila, data: parsed.data, proveedor: record.proveedor?.trim() || null });
    } catch (error) {
      errores.push({ fila, motivo: error instanceof Error ? error.message : "Fila inválida" });
    }
  });

  return { rows, errores };
}
