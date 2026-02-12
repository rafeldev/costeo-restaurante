import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hasPrismaErrorCode } from "@/lib/prisma-errors";
import { decimalToNumber } from "@/lib/serializers";
import { parseNumberInput, recetaSchema } from "@/lib/validation";

export const runtime = "nodejs";

function serializeReceta(receta: {
  id: string;
  nombre: string;
  tipoProducto: string;
  rendimientoPorciones: number;
  tiempoPreparacionMin: number | null;
  precioVentaActual: { toNumber: () => number } | null;
  createdAt: Date;
  updatedAt: Date;
  ingredientes?: Array<{
    id: string;
    recetaId: string;
    insumoId: string;
    cantidad: { toNumber: () => number };
    insumo?: {
      id: string;
      nombre: string;
      categoria: string;
    };
  }>;
}) {
  return {
    ...receta,
    precioVentaActual: decimalToNumber(receta.precioVentaActual),
    ingredientes: receta.ingredientes?.map((item) => ({
      ...item,
      cantidad: decimalToNumber(item.cantidad),
    })),
  };
}

export async function GET() {
  const recetas = await db.receta.findMany({
    include: {
      ingredientes: {
        include: { insumo: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(recetas.map(serializeReceta));
}

export async function POST(request: Request) {
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

    const created = await db.receta.create({
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

    return NextResponse.json(serializeReceta(created), { status: 201 });
  } catch (error) {
    if (hasPrismaErrorCode(error, "P2003")) {
      return NextResponse.json(
        { message: "Uno o más insumos no existen." },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { message: "No se pudo crear la receta." },
      { status: 500 },
    );
  }
}
