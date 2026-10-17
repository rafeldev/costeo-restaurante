import { NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/auth";
import { handleRouteError } from "@/lib/api-errors";
import { NotFoundError } from "@/lib/errors";
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
  try {
    const user = await requireAuthUser();
    const insumo = await db.insumo.findFirst({
      where: { id, ownerId: user.id },
      select: { id: true },
    });
    if (!insumo) throw new NotFoundError("Insumo no encontrado");
    const inventario = await ensureInventario(id);
    return NextResponse.json(serializeInventario(inventario));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  try {
    const user = await requireAuthUser();
    const insumo = await db.insumo.findFirst({
      where: { id, ownerId: user.id },
      select: { id: true },
    });
    if (!insumo) throw new NotFoundError("Insumo no encontrado");
    const body = await request.json();
    const parsed = inventarioPatchSchema.safeParse({
      stockMinimo: parseNumberInput(body.stockMinimo),
      areaId: body.areaId === "" ? null : body.areaId,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { message: "Datos inválidos", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }

    if (parsed.data.areaId) {
      const area = await db.areaAlmacen.findFirst({
        where: { id: parsed.data.areaId, ownerId: user.id },
        select: { id: true },
      });
      if (!area) throw new NotFoundError("Área no encontrada");
    }
    const inventario = await db.$transaction(async (tx) => {
      await tx.insumo.update({ where: { id }, data: { areaId: parsed.data.areaId } });
      return tx.inventarioInsumo.upsert({
        where: { insumoId: id },
        create: { insumoId: id, stockActual: 0, stockMinimo: parsed.data.stockMinimo },
        update: { stockMinimo: parsed.data.stockMinimo },
      });
    });

    return NextResponse.json(serializeInventario(inventario));
  } catch (error) {
    return handleRouteError(error);
  }
}
