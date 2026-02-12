import { UnidadBase } from "@prisma/client";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { registrarCompraInsumo } from "@/lib/inventory";
import { decimalToNumber } from "@/lib/serializers";
import { compraInsumoSchema, parseNumberInput } from "@/lib/validation";

export const runtime = "nodejs";

function serializeCompra(compra: {
  id: string;
  insumoId: string;
  proveedorId: string | null;
  fechaCompra: Date;
  cantidadCompra: { toNumber: () => number };
  unidadCompra: UnidadBase;
  precioTotal: { toNumber: () => number };
  costoUnitarioCalculado: { toNumber: () => number };
  createdAt: Date;
  updatedAt: Date;
  insumo?: { id: string; nombre: string; unidadBase: UnidadBase };
  proveedor?: { id: string; nombre: string } | null;
}) {
  return {
    ...compra,
    cantidadCompra: decimalToNumber(compra.cantidadCompra),
    precioTotal: decimalToNumber(compra.precioTotal),
    costoUnitarioCalculado: decimalToNumber(compra.costoUnitarioCalculado),
  };
}

export async function GET() {
  const compras = await db.compraInsumo.findMany({
    include: {
      insumo: {
        select: { id: true, nombre: true, unidadBase: true },
      },
      proveedor: {
        select: { id: true, nombre: true },
      },
    },
    orderBy: { fechaCompra: "desc" },
  });

  return NextResponse.json(compras.map(serializeCompra));
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = compraInsumoSchema.safeParse({
      ...body,
      cantidadCompra: parseNumberInput(body.cantidadCompra),
      precioTotal: parseNumberInput(body.precioTotal),
    });

    if (!parsed.success) {
      return NextResponse.json(
        { message: "Datos inválidos", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const result = await registrarCompraInsumo({
      insumoId: parsed.data.insumoId,
      proveedorId: parsed.data.proveedorId ?? null,
      fechaCompra: parsed.data.fechaCompra ? new Date(parsed.data.fechaCompra) : undefined,
      cantidadCompra: parsed.data.cantidadCompra,
      unidadCompra: parsed.data.unidadCompra,
      precioTotal: parsed.data.precioTotal,
    });

    const compra = await db.compraInsumo.findUnique({
      where: { id: result.compra.id },
      include: {
        insumo: {
          select: { id: true, nombre: true, unidadBase: true },
        },
        proveedor: {
          select: { id: true, nombre: true },
        },
      },
    });

    if (!compra) {
      return NextResponse.json(
        { message: "Compra registrada pero no pudo recuperarse." },
        { status: 500 },
      );
    }

    return NextResponse.json(serializeCompra(compra), { status: 201 });
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }
    return NextResponse.json(
      { message: "No se pudo registrar la compra." },
      { status: 500 },
    );
  }
}
