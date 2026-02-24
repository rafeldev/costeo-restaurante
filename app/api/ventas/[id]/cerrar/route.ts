import { NextResponse } from "next/server";
import { UnauthorizedError, requireAuthUser, unauthorizedResponse } from "@/lib/auth";
import { db } from "@/lib/db";
import { descontarInventarioPorVenta } from "@/lib/inventory";
import { hasPrismaErrorCode } from "@/lib/prisma-errors";
import { decimalToNumber } from "@/lib/serializers";
import { serializeVenta } from "@/lib/ventas";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  try {
    const user = await requireAuthUser();
    const { id } = await context.params;

    const venta = await db.$transaction(async (tx) => {
      const existing = await tx.venta.findFirst({
        where: { id, ownerId: user.id },
        include: {
          items: {
            include: { receta: { select: { id: true } } },
          },
        },
      });

      if (!existing) {
        throw new Error("NOT_FOUND");
      }
      if (existing.estado !== "ABIERTA") {
        throw new Error("VENTA_NO_ABIERTA");
      }
      if (existing.items.length === 0) {
        throw new Error("VENTA_SIN_ITEMS");
      }

      const total = existing.items.reduce(
        (sum, item) => sum + (decimalToNumber(item.subtotal) ?? 0),
        0,
      );

      await tx.venta.update({
        where: { id },
        data: { estado: "CERRADA", total },
      });

      await descontarInventarioPorVenta(
        {
          ownerId: user.id,
          ventaId: id,
          items: existing.items.map((i) => ({
            recetaId: i.recetaId,
            cantidad: decimalToNumber(i.cantidad) ?? 0,
          })),
        },
        tx,
      );

      return tx.venta.findFirst({
        where: { id },
        include: {
          items: {
            include: { receta: { select: { id: true, nombre: true } } },
          },
        },
      });
    });

    if (!venta) {
      return NextResponse.json({ message: "Venta no encontrada" }, { status: 404 });
    }

    return NextResponse.json(serializeVenta(venta));
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return unauthorizedResponse();
    }
    if (error instanceof Error) {
      if (error.message === "NOT_FOUND") {
        return NextResponse.json({ message: "Venta no encontrada" }, { status: 404 });
      }
      if (error.message === "VENTA_NO_ABIERTA") {
        return NextResponse.json(
          { message: "Solo se puede cerrar una venta en estado ABIERTA." },
          { status: 400 },
        );
      }
      if (error.message === "VENTA_SIN_ITEMS") {
        return NextResponse.json(
          { message: "La venta debe tener al menos un ítem para cerrar." },
          { status: 400 },
        );
      }
      return NextResponse.json({ message: error.message }, { status: 400 });
    }
    if (hasPrismaErrorCode(error, "P2025")) {
      return NextResponse.json({ message: "Venta no encontrada" }, { status: 404 });
    }
    return NextResponse.json(
      { message: "No se pudo cerrar la venta." },
      { status: 500 },
    );
  }
}
