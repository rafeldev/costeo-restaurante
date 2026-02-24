import { NextResponse } from "next/server";
import { UnauthorizedError, requireAuthUser, unauthorizedResponse } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasPrismaErrorCode } from "@/lib/prisma-errors";
import { serializeVenta } from "@/lib/ventas";
import { ventaPatchSchema } from "@/lib/validation";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireAuthUser();
    const { id } = await context.params;

    const venta = await db.venta.findFirst({
      where: { id, ownerId: user.id },
      include: {
        items: {
          include: { receta: { select: { id: true, nombre: true } } },
        },
      },
    });

    if (!venta) {
      return NextResponse.json({ message: "Venta no encontrada" }, { status: 404 });
    }

    return NextResponse.json(serializeVenta(venta));
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return unauthorizedResponse();
    }
    return NextResponse.json(
      { message: "No se pudo consultar la venta." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireAuthUser();
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const parsed = ventaPatchSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { message: "Datos inválidos", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const existing = await db.venta.findFirst({
      where: { id, ownerId: user.id },
      select: { id: true, estado: true },
    });

    if (!existing) {
      return NextResponse.json({ message: "Venta no encontrada" }, { status: 404 });
    }
    if (existing.estado !== "ABIERTA") {
      return NextResponse.json(
        { message: "Solo se puede actualizar una venta abierta." },
        { status: 400 },
      );
    }

    const venta = await db.venta.update({
      where: { id },
      data: {
        mesa: parsed.data.mesa !== undefined ? parsed.data.mesa || null : undefined,
        notas: parsed.data.notas !== undefined ? parsed.data.notas || null : undefined,
      },
      include: {
        items: {
          include: { receta: { select: { id: true, nombre: true } } },
        },
      },
    });

    return NextResponse.json(serializeVenta(venta));
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return unauthorizedResponse();
    }
    if (hasPrismaErrorCode(error, "P2025")) {
      return NextResponse.json({ message: "Venta no encontrada" }, { status: 404 });
    }
    return NextResponse.json(
      { message: "No se pudo actualizar la venta." },
      { status: 500 },
    );
  }
}
