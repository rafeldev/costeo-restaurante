import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/api-errors";
import { requireAuthUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { recetaInclude, serializeReceta, updateReceta } from "@/lib/receta-service";
import { parseNumberInput, recetaSchema } from "@/lib/validation";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

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

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireAuthUser();
    const { id } = await context.params;
    const receta = await db.receta.findFirst({
      where: { id, ownerId: user.id },
      include: recetaInclude,
    });
    if (!receta) return NextResponse.json({ message: "Receta no encontrada." }, { status: 404 });
    return NextResponse.json(serializeReceta(receta));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireAuthUser();
    const { id } = await context.params;
    const body = (await request.json()) as Record<string, unknown>;
    const parsed = recetaSchema.safeParse(normalizeBody(body));
    if (!parsed.success) {
      return NextResponse.json(
        { message: "Datos inválidos.", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }
    return NextResponse.json(serializeReceta(await updateReceta(user.id, id, parsed.data)));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await requireAuthUser();
    const { id } = await context.params;
    const deleted = await db.receta.deleteMany({ where: { id, ownerId: user.id } });
    if (!deleted.count) return NextResponse.json({ message: "Receta no encontrada." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
