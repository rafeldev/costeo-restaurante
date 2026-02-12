import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getEstadoReposicion } from "@/lib/inventory-rules";
import { decimalToNumber } from "@/lib/serializers";

export const runtime = "nodejs";

export async function GET() {
  const inventarios = await db.inventarioInsumo.findMany({
    include: {
      insumo: {
        select: { id: true, nombre: true },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  const data = inventarios.map((item) => {
    const stockActual = decimalToNumber(item.stockActual) ?? 0;
    const stockMinimo = decimalToNumber(item.stockMinimo) ?? 0;
    return {
      insumoId: item.insumoId,
      nombre: item.insumo.nombre,
      stockActual,
      stockMinimo,
      estadoReposicion: getEstadoReposicion(stockActual, stockMinimo),
    };
  });

  return NextResponse.json(data.sort((a, b) => a.stockActual - b.stockActual));
}
