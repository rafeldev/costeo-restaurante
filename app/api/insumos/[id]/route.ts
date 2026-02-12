import { UnidadBase } from "@prisma/client";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hasPrismaErrorCode } from "@/lib/prisma-errors";
import { decimalToNumber } from "@/lib/serializers";
import { insumoSchema, parseNumberInput } from "@/lib/validation";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;

  try {
    const body = await request.json();
    const parsed = insumoSchema.partial().safeParse({
      ...body,
      costoUnidad: parseNumberInput(body.costoUnidad),
      mermaPct: parseNumberInput(body.mermaPct),
    });

    if (!parsed.success) {
      return NextResponse.json(
        { message: "Datos inválidos", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const updated = await db.insumo.update({
      where: { id },
      data: {
        nombre: parsed.data.nombre,
        categoria: parsed.data.categoria,
        unidadBase: parsed.data.unidadBase as UnidadBase | undefined,
        costoUnidad: parsed.data.costoUnidad,
        mermaPct: parsed.data.mermaPct,
        proveedor:
          parsed.data.proveedor === undefined
            ? undefined
            : parsed.data.proveedor || null,
      },
    });

    return NextResponse.json({
      ...updated,
      costoUnidad: decimalToNumber(updated.costoUnidad),
      mermaPct: decimalToNumber(updated.mermaPct),
    });
  } catch (error) {
    if (hasPrismaErrorCode(error, "P2025")) {
      return NextResponse.json({ message: "Insumo no encontrado" }, { status: 404 });
    }
    if (hasPrismaErrorCode(error, "P2002")) {
      return NextResponse.json(
        { message: "Ya existe un insumo con ese nombre." },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { message: "No se pudo actualizar el insumo." },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  try {
    await db.insumo.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (hasPrismaErrorCode(error, "P2025")) {
      return NextResponse.json({ message: "Insumo no encontrado" }, { status: 404 });
    }
    if (hasPrismaErrorCode(error, "P2003")) {
      return NextResponse.json(
        { message: "No puedes eliminar un insumo usado en recetas." },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { message: "No se pudo eliminar el insumo." },
      { status: 500 },
    );
  }
}
