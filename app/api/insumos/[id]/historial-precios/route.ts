import { NextResponse } from "next/server";
import { UnauthorizedError, requireAuthUser, unauthorizedResponse } from "@/lib/auth";
import { db } from "@/lib/db";
import { decimalToNumber } from "@/lib/serializers";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  try {
    const user = await requireAuthUser();
    const insumo = await db.insumo.findFirst({
      where: { id, ownerId: user.id },
      select: { id: true },
    });
    if (!insumo) {
      return NextResponse.json({ message: "Insumo no encontrado" }, { status: 404 });
    }

    const compras = await db.compraInsumo.findMany({
      where: { insumoId: id },
      include: {
        proveedor: {
          select: { id: true, nombre: true },
        },
        insumo: {
          select: { id: true, nombre: true, unidadBase: true },
        },
      },
      orderBy: { fechaCompra: "desc" },
    });

    return NextResponse.json(
      compras.map((compra) => ({
        ...compra,
        cantidadCompra: decimalToNumber(compra.cantidadCompra),
        precioTotal: decimalToNumber(compra.precioTotal),
        costoUnitarioCalculado: decimalToNumber(compra.costoUnitarioCalculado),
      })),
    );
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return unauthorizedResponse();
    }
    return NextResponse.json(
      { message: "No se pudo consultar historial de precios." },
      { status: 500 },
    );
  }
}
