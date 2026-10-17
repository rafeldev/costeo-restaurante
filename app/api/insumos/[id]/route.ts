import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/api-errors";
import { requireAuthUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { updateInsumo } from "@/lib/insumo-service";
import { serializeInsumo } from "@/lib/insumos";
import { insumoPatchSchema, parseNumberInput } from "@/lib/validation";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireAuthUser();
    const { id } = await context.params;
    const body = (await request.json()) as Record<string, unknown>;
    const parsed = insumoPatchSchema.safeParse({
      ...body,
      costoUnidad:
        body.costoUnidad === undefined
          ? undefined
          : parseNumberInput(body.costoUnidad) ?? body.costoUnidad,
      mermaPct:
        body.mermaPct === undefined
          ? undefined
          : parseNumberInput(body.mermaPct) ?? body.mermaPct,
      presentacionCantidad:
        body.presentacionCantidad === undefined
          ? undefined
          : body.presentacionCantidad === null || body.presentacionCantidad === ""
            ? null
            : parseNumberInput(body.presentacionCantidad) ?? body.presentacionCantidad,
      precioPresentacion:
        body.precioPresentacion === undefined
          ? undefined
          : body.precioPresentacion === null || body.precioPresentacion === ""
            ? null
            : parseNumberInput(body.precioPresentacion) ?? body.precioPresentacion,
    });
    if (!parsed.success) {
      return NextResponse.json(
        { message: "Datos inválidos.", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const updated = await updateInsumo(user.id, id, parsed.data);
    return NextResponse.json(serializeInsumo(updated));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await requireAuthUser();
    const { id } = await context.params;
    const deleted = await db.insumo.deleteMany({ where: { id, ownerId: user.id } });
    if (deleted.count === 0) {
      return NextResponse.json({ message: "Insumo no encontrado." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
