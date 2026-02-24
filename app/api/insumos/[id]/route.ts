import { UnidadBase } from "@prisma/client";
import { NextResponse } from "next/server";
import { UnauthorizedError, requireAuthUser, unauthorizedResponse } from "@/lib/auth";
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
    const user = await requireAuthUser();
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

    const existing = await db.insumo.findFirst({
      where: { id, ownerId: user.id },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ message: "Insumo no encontrado" }, { status: 404 });
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
      include: {
        _count: { select: { recetaInsumos: true } },
      },
    });

    return NextResponse.json({
      ...updated,
      costoUnidad: decimalToNumber(updated.costoUnidad),
      mermaPct: decimalToNumber(updated.mermaPct),
      recetasCount: updated._count.recetaInsumos,
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return unauthorizedResponse();
    }
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
    const user = await requireAuthUser();
    const deleted = await db.insumo.deleteMany({ where: { id, ownerId: user.id } });
    if (deleted.count === 0) {
      return NextResponse.json({ message: "Insumo no encontrado" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return unauthorizedResponse();
    }
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
