import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/api-errors";
import { requireAuthUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import { areaAlmacenPatchSchema, parseNumberInput } from "@/lib/validation";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireAuthUser();
    const { id } = await context.params;
    const body = await request.json();
    const parsed = areaAlmacenPatchSchema.safeParse({
      nombre: body.nombre,
      orden: body.orden === undefined ? undefined : parseNumberInput(body.orden),
    });
    if (!parsed.success) {
      return NextResponse.json({ message: "Datos del área inválidos", issues: parsed.error.flatten() }, { status: 400 });
    }
    const exists = await db.areaAlmacen.findFirst({ where: { id, ownerId: user.id }, select: { id: true } });
    if (!exists) throw new NotFoundError("Área no encontrada");
    const area = await db.areaAlmacen.update({ where: { id }, data: parsed.data });
    return NextResponse.json(area);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await requireAuthUser();
    const { id } = await context.params;
    const deleted = await db.areaAlmacen.deleteMany({ where: { id, ownerId: user.id } });
    if (deleted.count === 0) throw new NotFoundError("Área no encontrada");
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
