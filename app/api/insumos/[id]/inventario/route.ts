import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getEstadoReposicion } from "@/lib/inventory-rules";
import { decimalToNumber } from "@/lib/serializers";
import { inventarioPatchSchema, parseNumberInput } from "@/lib/validation";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function ensureInventario(insumoId: string) {
  return db.inventarioInsumo.upsert({
    where: { insumoId },
    create: { insumoId, stockActual: 0, stockMinimo: 0 },
    update: {},
  });
}

function serializeInventario(inventario: {
  insumoId: string;
  stockActual: { toNumber: () => number };
  stockMinimo: { toNumber: () => number };
  updatedAt: Date;
}) {
  const stockActual = decimalToNumber(inventario.stockActual) ?? 0;
  const stockMinimo = decimalToNumber(inventario.stockMinimo) ?? 0;
  return {
    ...inventario,
    stockActual,
    stockMinimo,
    estadoReposicion: getEstadoReposicion(stockActual, stockMinimo),
  };
}

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const insumo = await db.insumo.findUnique({ where: { id }, select: { id: true } });
  if (!insumo) {
    return NextResponse.json({ message: "Insumo no encontrado" }, { status: 404 });
  }
  const inventario = await ensureInventario(id);
  return NextResponse.json(serializeInventario(inventario));
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const insumo = await db.insumo.findUnique({ where: { id }, select: { id: true } });
  if (!insumo) {
    return NextResponse.json({ message: "Insumo no encontrado" }, { status: 404 });
  }
  const body = await request.json();
  const parsed = inventarioPatchSchema.safeParse({
    stockMinimo: parseNumberInput(body.stockMinimo),
  });

  if (!parsed.success) {
    return NextResponse.json(
      { message: "Datos inválidos", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const inventario = await db.inventarioInsumo.upsert({
    where: { insumoId: id },
    create: { insumoId: id, stockActual: 0, stockMinimo: parsed.data.stockMinimo },
    update: { stockMinimo: parsed.data.stockMinimo },
  });

  return NextResponse.json(serializeInventario(inventario));
}
