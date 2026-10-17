import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/api-errors";
import { requireAuthUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { createReceta } from "@/lib/receta-service";
import { groupRecetasCsv, parseRecetasCsv, type CsvRowError } from "@/lib/recetas-csv";

export const runtime = "nodejs";
const MAX_CSV_BYTES = 2 * 1024 * 1024;

async function readCsv(request: Request) {
  const file = (await request.formData()).get("archivo");
  if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".csv")) {
    throw new Error("Adjunta un archivo CSV.");
  }
  if (file.size > MAX_CSV_BYTES) throw new Error("El archivo supera el límite de 2 MB.");
  return file.text();
}

export async function POST(request: Request) {
  try {
    const user = await requireAuthUser();
    let csv: string;
    try {
      csv = await readCsv(request);
    } catch (error) {
      return NextResponse.json(
        { message: error instanceof Error ? error.message : "Archivo inválido." },
        { status: 400 },
      );
    }
    const report = parseRecetasCsv(csv);
    const grouped = groupRecetasCsv(report.rows);
    const errores: CsvRowError[] = [...report.errores, ...grouped.errores];
    const codes = [...new Set(report.rows.map((row) => row.insumoCodigo))];
    const insumos = await db.insumo.findMany({
      where: { ownerId: user.id, activo: true, codigo: { in: codes } },
      select: { id: true, codigo: true },
    });
    const byCode = new Map(insumos.map((item) => [item.codigo.toUpperCase(), item.id]));
    let creados = 0;
    for (const recipe of grouped.recipes) {
      const missingCode = recipe.ingredientes.find(
        (item) => !byCode.has(item.insumoCodigo.toUpperCase()),
      )?.insumoCodigo;
      if (missingCode) {
        errores.push({ fila: recipe.fila, motivo: `Insumo no encontrado: ${missingCode}` });
        continue;
      }
      try {
        await createReceta(user.id, {
          ...recipe.data,
          ingredientes: recipe.ingredientes.map((item) => ({
            insumoId: byCode.get(item.insumoCodigo.toUpperCase())!,
            cantidad: item.cantidad,
          })),
        });
        creados += 1;
      } catch {
        errores.push({ fila: recipe.fila, motivo: "No se pudo crear la receta" });
      }
    }
    return NextResponse.json({ creados, errores });
  } catch (error) {
    return handleRouteError(error);
  }
}
