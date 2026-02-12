import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
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
  precioVentaActual: Prisma.Decimal | null;
  createdAt: Date;
  updatedAt: Date;
  ingredientes: Array<{
    id: string;
    recetaId: string;
    insumoId: string;
    cantidad: Prisma.Decimal;
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
  const receta = await db.receta.findUnique({
    where: { id },
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
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  try {
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
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
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
    await db.receta.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return NextResponse.json({ message: "Receta no encontrada" }, { status: 404 });
    }

    return NextResponse.json(
      { message: "No se pudo eliminar la receta." },
      { status: 500 },
    );
  }
}
