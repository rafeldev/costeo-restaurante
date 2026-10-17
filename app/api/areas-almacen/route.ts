import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/api-errors";
import { requireAuthUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { areaAlmacenSchema, parseNumberInput } from "@/lib/validation";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await requireAuthUser();
    const areas = await db.areaAlmacen.findMany({
      where: { ownerId: user.id },
      include: { _count: { select: { insumos: true } } },
      orderBy: [{ orden: "asc" }, { nombre: "asc" }],
    });
    return NextResponse.json(areas.map(({ _count, ...area }) => ({
      ...area,
      insumosCount: _count.insumos,
    })));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuthUser();
    const body = (await request.json()) as Record<string, unknown>;
    const parsed = areaAlmacenSchema.safeParse({
      nombre: body.nombre,
      orden: parseNumberInput(body.orden) ?? 0,
    });
    if (!parsed.success) {
      return NextResponse.json(
        { message: "Datos del área inválidos.", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const area = await db.areaAlmacen.create({ data: { ownerId: user.id, ...parsed.data } });
    return NextResponse.json({ ...area, insumosCount: 0 }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
