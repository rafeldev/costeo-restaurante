import { NextResponse } from "next/server";
import { UnauthorizedError, requireAuthUser, unauthorizedResponse } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasPrismaErrorCode } from "@/lib/prisma-errors";
import { serializeVenta } from "@/lib/ventas";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  try {
    const user = await requireAuthUser();
    const { id } = await context.params;

    const existing = await db.venta.findFirst({
      where: { id, ownerId: user.id },
      select: { id: true, estado: true },
    });

    if (!existing) {
      return NextResponse.json({ message: "Venta no encontrada" }, { status: 404 });
    }
    if (existing.estado !== "ABIERTA") {
      return NextResponse.json(
        { message: "Solo se puede cancelar una venta en estado ABIERTA." },
        { status: 400 },
      );
    }

    const venta = await db.venta.update({
      where: { id },
      data: { estado: "CANCELADA" },
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
      { message: "No se pudo cancelar la venta." },
      { status: 500 },
    );
  }
}
