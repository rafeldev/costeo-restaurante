import { NextResponse } from "next/server";
import { UnauthorizedError, requireAuthUser, unauthorizedResponse } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasPrismaErrorCode } from "@/lib/prisma-errors";
import { decimalToNumber } from "@/lib/serializers";
import { parseNumberInput, recetaSchema } from "@/lib/validation";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function serializeReceta(receta: {
  id: string;
  nombre: string;
  tipoProducto: string;
  rendimientoPorciones: number;
  tiempoPreparacionMin: number | null;
  precioVentaActual: { toNumber: () => number } | null;
  createdAt: Date;
  updatedAt: Date;
  ingredientes: Array<{
    id: string;
    recetaId: string;
    insumoId: string;
    cantidad: { toNumber: () => number };
    insumo: {
      id: string;
      nombre: string;
      categoria: string;
    };
  }>;
}) {
  return {
    ...receta,
    precioVentaActual: decimalToNumber(receta.precioVentaActual),
    ingredientes: receta.ingredientes.map((item) => ({
      ...item,
      cantidad: decimalToNumber(item.cantidad),
    })),
  };
}

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  try {
    const user = await requireAuthUser();
    const receta = await db.receta.findFirst({
      where: { id, ownerId: user.id },
      include: {
        ingredientes: {
          include: { insumo: true },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!receta) {
      return NextResponse.json({ message: "Receta no encontrada" }, { status: 404 });
    }

    return NextResponse.json(serializeReceta(receta));
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return unauthorizedResponse();
    }
    return NextResponse.json(
      { message: "No se pudo consultar la receta." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  try {
    const user = await requireAuthUser();
    const body = await request.json();
    const parsed = recetaSchema.safeParse({
      ...body,
      rendimientoPorciones: parseNumberInput(body.rendimientoPorciones),
      tiempoPreparacionMin: parseNumberInput(body.tiempoPreparacionMin),
      precioVentaActual: parseNumberInput(body.precioVentaActual),
      ingredientes: Array.isArray(body.ingredientes)
        ? body.ingredientes.map((item: { insumoId: string; cantidad: unknown }) => ({
            ...item,
            cantidad: parseNumberInput(item.cantidad),
          }))
        : [],
    });

    if (!parsed.success) {
      return NextResponse.json(
        { message: "Datos inválidos", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const existing = await db.receta.findFirst({
      where: { id, ownerId: user.id },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ message: "Receta no encontrada" }, { status: 404 });
    }

    const insumoIds = [...new Set(parsed.data.ingredientes.map((item) => item.insumoId))];
    const ownedInsumos = await db.insumo.count({
      where: {
        ownerId: user.id,
        id: { in: insumoIds },
      },
    });
    if (ownedInsumos !== insumoIds.length) {
      return NextResponse.json(
        { message: "Uno o más insumos no pertenecen al usuario autenticado." },
        { status: 403 },
      );
    }

    const updated = await db.$transaction(async (tx) => {
      await tx.recetaInsumo.deleteMany({ where: { recetaId: id } });
      return tx.receta.update({
        where: { id },
        data: {
          nombre: parsed.data.nombre,
          tipoProducto: parsed.data.tipoProducto,
          rendimientoPorciones: parsed.data.rendimientoPorciones,
          tiempoPreparacionMin: parsed.data.tiempoPreparacionMin ?? null,
          precioVentaActual: parsed.data.precioVentaActual ?? null,
          ingredientes: {
            create: parsed.data.ingredientes.map((item) => ({
              insumoId: item.insumoId,
              cantidad: item.cantidad,
            })),
          },
        },
        include: {
          ingredientes: {
            include: { insumo: true },
          },
        },
      });
    });

    return NextResponse.json(serializeReceta(updated));
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return unauthorizedResponse();
    }
    if (hasPrismaErrorCode(error, "P2025")) {
      return NextResponse.json({ message: "Receta no encontrada" }, { status: 404 });
    }

    return NextResponse.json(
      { message: "No se pudo actualizar la receta." },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  try {
    const user = await requireAuthUser();
    const deleted = await db.receta.deleteMany({ where: { id, ownerId: user.id } });
    if (deleted.count === 0) {
      return NextResponse.json({ message: "Receta no encontrada" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return unauthorizedResponse();
    }
    if (hasPrismaErrorCode(error, "P2025")) {
      return NextResponse.json({ message: "Receta no encontrada" }, { status: 404 });
    }

    return NextResponse.json(
      { message: "No se pudo eliminar la receta." },
      { status: 500 },
    );
  }
}
