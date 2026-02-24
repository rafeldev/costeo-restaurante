import type { EstadoVenta } from "@prisma/client";
import { NextResponse } from "next/server";
import { UnauthorizedError, requireAuthUser, unauthorizedResponse } from "@/lib/auth";
import { db } from "@/lib/db";
import { serializeVenta } from "@/lib/ventas";
import { ventaCreateSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await requireAuthUser();
    const { searchParams } = new URL(request.url);
    const estadoParam = searchParams.get("estado");

    const where: { ownerId: string; estado?: EstadoVenta } = { ownerId: user.id };
    if (
      estadoParam === "ABIERTA" ||
      estadoParam === "CERRADA" ||
      estadoParam === "CANCELADA"
    ) {
      where.estado = estadoParam as EstadoVenta;
    }

    const ventas = await db.venta.findMany({
      where,
      include: {
        items: {
          include: { receta: { select: { id: true, nombre: true } } },
        },
      },
      orderBy: { fechaHora: "desc" },
    });

    return NextResponse.json(ventas.map(serializeVenta));
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return unauthorizedResponse();
    }
    return NextResponse.json(
      { message: "No se pudo consultar las ventas." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuthUser();
    const body = await request.json().catch(() => ({}));
    const parsed = ventaCreateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { message: "Datos inválidos", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const venta = await db.venta.create({
      data: {
        ownerId: user.id,
        mesa: parsed.data.mesa || null,
        notas: parsed.data.notas || null,
      },
      include: {
        items: {
          include: { receta: { select: { id: true, nombre: true } } },
        },
      },
    });

    return NextResponse.json(serializeVenta(venta), { status: 201 });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return unauthorizedResponse();
    }
    return NextResponse.json(
      { message: "No se pudo crear la venta." },
      { status: 500 },
    );
  }
}
