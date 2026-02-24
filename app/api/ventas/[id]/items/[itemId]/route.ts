import { NextResponse } from "next/server";
import { UnauthorizedError, requireAuthUser, unauthorizedResponse } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasPrismaErrorCode } from "@/lib/prisma-errors";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string; itemId: string }> };

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await requireAuthUser();
    const { id, itemId } = await context.params;

    const venta = await db.venta.findFirst({
      where: { id, ownerId: user.id },
      select: { id: true, estado: true },
    });

    if (!venta) {
      return NextResponse.json({ message: "Venta no encontrada" }, { status: 404 });
    }
    if (venta.estado !== "ABIERTA") {
      return NextResponse.json(
        { message: "Solo se pueden eliminar ítems de una venta abierta." },
        { status: 400 },
      );
    }

    const deleted = await db.ventaItem.deleteMany({
      where: {
        id: itemId,
        ventaId: id,
      },
    });

    if (deleted.count === 0) {
      return NextResponse.json({ message: "Ítem no encontrado" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return unauthorizedResponse();
    }
    if (hasPrismaErrorCode(error, "P2025")) {
      return NextResponse.json({ message: "Ítem no encontrado" }, { status: 404 });
    }
    return NextResponse.json(
      { message: "No se pudo eliminar el ítem." },
      { status: 500 },
    );
  }
}
