import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/api-errors";
import { requireAuthUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { createInsumo } from "@/lib/insumo-service";
import { parseInsumosCsv, type CsvRowError } from "@/lib/insumos-csv";
import { DomainError } from "@/lib/errors";
import { hasPrismaErrorCode } from "@/lib/prisma-errors";

export const runtime = "nodejs";
const MAX_CSV_BYTES = 2 * 1024 * 1024;

async function readCsv(request: Request) {
  if (request.headers.get("content-type")?.includes("multipart/form-data")) {
    const file = (await request.formData()).get("archivo");
    if (!(file instanceof File)) throw new Error("Adjunta un archivo CSV.");
    if (file.size > MAX_CSV_BYTES) throw new Error("El archivo supera el límite de 2 MB.");
    return file.text();
  }
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_CSV_BYTES) {
    throw new Error("El archivo supera el límite de 2 MB.");
  }
  return text;
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
    const report = parseInsumosCsv(csv);
    const errores: CsvRowError[] = [...report.errores];
    let creados = 0;

    for (const row of report.rows) {
      try {
        let proveedorPreferidoId: string | null = null;
        if (row.proveedor) {
          const proveedor = await db.proveedor.findFirst({
            where: {
              ownerId: user.id,
              activo: true,
              OR: [
                { codigo: { equals: row.proveedor, mode: "insensitive" } },
                { nombre: { equals: row.proveedor, mode: "insensitive" } },
              ],
            },
            select: { id: true },
          });
          if (!proveedor) throw new DomainError(`Proveedor no encontrado: ${row.proveedor}`);
          proveedorPreferidoId = proveedor.id;
        }
        await createInsumo(user.id, { ...row.data, proveedorPreferidoId });
        creados += 1;
      } catch (error) {
        const motivo = hasPrismaErrorCode(error, "P2002")
          ? "Ya existe un insumo con ese nombre o código"
          : error instanceof DomainError
            ? error.message
            : "No se pudo crear el insumo";
        errores.push({ fila: row.fila, motivo });
      }
    }

    return NextResponse.json({ creados, errores });
  } catch (error) {
    return handleRouteError(error);
  }
}
