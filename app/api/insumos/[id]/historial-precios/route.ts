import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { decimalToNumber } from "@/lib/serializers";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;

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
}
