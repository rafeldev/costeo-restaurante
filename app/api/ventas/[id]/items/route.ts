import { NextResponse } from "next/server";
import { UnauthorizedError, requireAuthUser, unauthorizedResponse } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasPrismaErrorCode } from "@/lib/prisma-errors";
import { serializeVentaItem } from "@/lib/ventas";
import { parseNumberInput, ventaItemSchema } from "@/lib/validation";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireAuthUser();
    const { id } = await context.params;

    const venta = await db.venta.findFirst({
      where: { id, ownerId: user.id },
      select: { id: true },
    });

    if (!venta) {
      return NextResponse.json({ message: "Venta no encontrada" }, { status: 404 });
    }

    const items = await db.ventaItem.findMany({
      where: { ventaId: id },
      include: { receta: { select: { id: true, nombre: true } } },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(items.map(serializeVentaItem));
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return unauthorizedResponse();
    }
    return NextResponse.json(
      { message: "No se pudo consultar los ítems." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireAuthUser();
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const parsed = ventaItemSchema.safeParse({
      ...body,
      cantidad: parseNumberInput(body.cantidad),
      precioUnitario: parseNumberInput(body.precioUnitario),
    });

    if (!parsed.success) {
      return NextResponse.json(
        { message: "Datos inválidos", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const venta = await db.venta.findFirst({
      where: { id, ownerId: user.id },
      select: { id: true, estado: true },
    });

    if (!venta) {
      return NextResponse.json({ message: "Venta no encontrada" }, { status: 404 });
    }
    if (venta.estado !== "ABIERTA") {
      return NextResponse.json(
        { message: "Solo se pueden añadir ítems a una venta abierta." },
        { status: 400 },
      );
    }

    const receta = await db.receta.findFirst({
      where: { id: parsed.data.recetaId, ownerId: user.id },
      select: { id: true, precioVentaActual: true },
    });

    if (!receta) {
      return NextResponse.json({ message: "Receta no encontrada" }, { status: 404 });
    }

    let precioUnitario: number;
    if (parsed.data.precioUnitario != null && parsed.data.precioUnitario > 0) {
      precioUnitario = parsed.data.precioUnitario;
    } else {
      const p = receta.precioVentaActual;
      if (p == null) {
        return NextResponse.json(
          {
            message:
              "La receta no tiene precio de venta. Indique precioUnitario en el body o configure precioVentaActual en la receta.",
          },
          { status: 400 },
        );
      }
      precioUnitario = typeof p === "number" ? p : (p as { toNumber: () => number }).toNumber();
    }

    const cantidad = parsed.data.cantidad;
    const subtotal = cantidad * precioUnitario;

    const item = await db.ventaItem.create({
      data: {
        ventaId: id,
        recetaId: parsed.data.recetaId,
        cantidad,
        precioUnitario,
        subtotal,
      },
      include: { receta: { select: { id: true, nombre: true } } },
    });

    return NextResponse.json(serializeVentaItem(item), { status: 201 });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return unauthorizedResponse();
    }
    if (hasPrismaErrorCode(error, "P2003")) {
      return NextResponse.json(
        { message: "Receta no encontrada o no pertenece al usuario." },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { message: "No se pudo añadir el ítem." },
      { status: 500 },
    );
  }
}
