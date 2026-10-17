import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/api-errors";
import { requireAuthUser } from "@/lib/auth";
import { normalizePagination } from "@/lib/pagination";
import { createReceta, getRecetasCatalogo, serializeReceta } from "@/lib/receta-service";
import { parseNumberInput, recetasQuerySchema, recetaSchema } from "@/lib/validation";

export const runtime = "nodejs";

function normalizeBody(body: Record<string, unknown>) {
  return {
    ...body,
    rendimientoPorciones: parseNumberInput(body.rendimientoPorciones),
    tiempoPreparacionMin: parseNumberInput(body.tiempoPreparacionMin),
    precioVentaActual: parseNumberInput(body.precioVentaActual),
    ingredientes: Array.isArray(body.ingredientes)
      ? body.ingredientes.map((item: { insumoId?: unknown; cantidad?: unknown }) => ({
          insumoId: item.insumoId,
          cantidad: parseNumberInput(item.cantidad),
        }))
      : [],
  };
}

export async function GET(request: Request) {
  try {
    const user = await requireAuthUser();
    const url = new URL(request.url);
    const pagination = normalizePagination(url.searchParams, { defaultPageSize: 8 });
    const filters = recetasQuerySchema.safeParse({
      categoria: url.searchParams.get("categoria") || undefined,
      estado: url.searchParams.get("estado") || undefined,
      insumoId: url.searchParams.get("insumoId") || undefined,
    });
    if (!filters.success) {
      return NextResponse.json({ message: "Filtros inválidos." }, { status: 400 });
    }
    return NextResponse.json(await getRecetasCatalogo(user.id, pagination, filters.data));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuthUser();
    const body = (await request.json()) as Record<string, unknown>;
    const parsed = recetaSchema.safeParse(normalizeBody(body));
    if (!parsed.success) {
      return NextResponse.json(
        { message: "Datos inválidos.", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const created = await createReceta(user.id, parsed.data);
    return NextResponse.json(serializeReceta(created), { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
