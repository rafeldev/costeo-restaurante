import { NextResponse } from "next/server";
import { UnauthorizedError, requireAuthUser, unauthorizedResponse } from "@/lib/auth";
import { db } from "@/lib/db";
import { getEstadoReposicion } from "@/lib/inventory-rules";
import { decimalToNumber } from "@/lib/serializers";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await requireAuthUser();
    const inventarios = await db.inventarioInsumo.findMany({
      where: {
        insumo: { ownerId: user.id },
      },
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
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return unauthorizedResponse();
    }
    return NextResponse.json(
      { message: "No se pudo consultar alertas de inventario." },
      { status: 500 },
    );
  }
}
