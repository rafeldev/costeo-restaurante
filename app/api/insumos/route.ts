import { UnidadBase } from "@prisma/client";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { UnauthorizedError, requireAuthUser, unauthorizedResponse } from "@/lib/auth";
import { getEstadoReposicion } from "@/lib/inventory-rules";
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
  inventario?: {
    stockActual: { toNumber: () => number };
    stockMinimo: { toNumber: () => number };
  } | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  const stockActual = insumo.inventario
    ? (decimalToNumber(insumo.inventario.stockActual) ?? 0)
    : null;
  const stockMinimo = insumo.inventario
    ? (decimalToNumber(insumo.inventario.stockMinimo) ?? 0)
    : null;
  return {
    ...insumo,
    costoUnidad: decimalToNumber(insumo.costoUnidad),
    mermaPct: decimalToNumber(insumo.mermaPct),
    inventario:
      stockActual === null || stockMinimo === null
        ? null
        : {
            stockActual,
            stockMinimo,
            estadoReposicion: getEstadoReposicion(stockActual, stockMinimo),
          },
  };
}

export async function GET() {
  try {
    const user = await requireAuthUser();
    const insumos = await db.insumo.findMany({
      where: { ownerId: user.id },
      include: { inventario: true },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(insumos.map(serializeInsumo));
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return unauthorizedResponse();
    }
    return NextResponse.json(
      { message: "No se pudo consultar los insumos." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuthUser();
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
        ownerId: user.id,
        nombre: parsed.data.nombre,
        categoria: parsed.data.categoria,
        unidadBase: parsed.data.unidadBase as UnidadBase,
        costoUnidad: parsed.data.costoUnidad,
        mermaPct: parsed.data.mermaPct,
        proveedor: parsed.data.proveedor || null,
        inventario: {
          create: {
            stockActual: 0,
            stockMinimo: 0,
          },
        },
      },
      include: {
        inventario: true,
      },
    });

    return NextResponse.json(serializeInsumo(created), { status: 201 });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return unauthorizedResponse();
    }
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
