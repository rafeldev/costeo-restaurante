import { TipoMovimientoInventario, UnidadBase } from "@prisma/client";
import { NextResponse } from "next/server";
import { UnauthorizedError, requireAuthUser, unauthorizedResponse } from "@/lib/auth";
import { db } from "@/lib/db";
import { registrarMovimientoInventario } from "@/lib/inventory";
import { decimalToNumber } from "@/lib/serializers";
import { movimientoInventarioSchema, parseNumberInput } from "@/lib/validation";

export const runtime = "nodejs";

function serializeMovimiento(movimiento: {
  id: string;
  insumoId: string;
  tipo: TipoMovimientoInventario;
  cantidad: { toNumber: () => number };
  motivo: string | null;
  fechaMovimiento: Date;
  referenciaCompraId: string | null;
  createdAt: Date;
  updatedAt: Date;
  insumo?: {
    id: string;
    nombre: string;
    unidadBase: UnidadBase;
  };
}) {
  return {
    ...movimiento,
    cantidad: decimalToNumber(movimiento.cantidad),
  };
}

export async function GET() {
  try {
    const user = await requireAuthUser();
    const movimientos = await db.movimientoInventario.findMany({
      where: {
        insumo: { ownerId: user.id },
      },
      include: {
        insumo: {
          select: { id: true, nombre: true, unidadBase: true },
        },
      },
      orderBy: { fechaMovimiento: "desc" },
      take: 150,
    });

    return NextResponse.json(movimientos.map(serializeMovimiento));
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return unauthorizedResponse();
    }
    return NextResponse.json(
      { message: "No se pudo consultar movimientos." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuthUser();
    const body = await request.json();
    const parsed = movimientoInventarioSchema.safeParse({
      ...body,
      cantidad: parseNumberInput(body.cantidad),
    });

    if (!parsed.success) {
      return NextResponse.json(
        { message: "Datos inválidos", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const result = await registrarMovimientoInventario({
      ownerId: user.id,
      insumoId: parsed.data.insumoId,
      tipo: parsed.data.tipo,
      cantidad: parsed.data.cantidad,
      motivo: parsed.data.motivo || undefined,
      fechaMovimiento: parsed.data.fechaMovimiento
        ? new Date(parsed.data.fechaMovimiento)
        : undefined,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return unauthorizedResponse();
    }
    if (error instanceof Error) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }
    return NextResponse.json(
      { message: "No se pudo registrar el movimiento." },
      { status: 500 },
    );
  }
}
