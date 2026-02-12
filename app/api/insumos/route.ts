import { UnidadBase } from "@prisma/client";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hasPrismaErrorCode } from "@/lib/prisma-errors";
import { decimalToNumber } from "@/lib/serializers";
import { insumoSchema, parseNumberInput } from "@/lib/validation";

export const runtime = "nodejs";

function serializeInsumo(insumo: {
  id: string;
  nombre: string;
  categoria: string;
  unidadBase: UnidadBase;
  costoUnidad: { toNumber: () => number };
  mermaPct: { toNumber: () => number };
  proveedor: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...insumo,
    costoUnidad: decimalToNumber(insumo.costoUnidad),
    mermaPct: decimalToNumber(insumo.mermaPct),
  };
}

export async function GET() {
  const insumos = await db.insumo.findMany({
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(insumos.map(serializeInsumo));
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = insumoSchema.safeParse({
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

    const created = await db.insumo.create({
      data: {
        nombre: parsed.data.nombre,
        categoria: parsed.data.categoria,
        unidadBase: parsed.data.unidadBase as UnidadBase,
        costoUnidad: parsed.data.costoUnidad,
        mermaPct: parsed.data.mermaPct,
        proveedor: parsed.data.proveedor || null,
      },
    });

    return NextResponse.json(serializeInsumo(created), { status: 201 });
  } catch (error) {
    if (hasPrismaErrorCode(error, "P2002")) {
      return NextResponse.json(
        { message: "Ya existe un insumo con ese nombre." },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { message: "No se pudo crear el insumo." },
      { status: 500 },
    );
  }
}
