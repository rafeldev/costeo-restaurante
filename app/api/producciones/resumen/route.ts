import { NextResponse } from "next/server";
import { UnauthorizedError, requireAuthUser, unauthorizedResponse } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await requireAuthUser();
    const { searchParams } = new URL(request.url);

    const desde = searchParams.get("desde");
    const hasta = searchParams.get("hasta");

    const now = new Date();
    const defaultDesde = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const defaultHasta = new Date(defaultDesde.getTime() + 86400000);

    const fechaDesde = desde ? new Date(desde) : defaultDesde;
    const fechaHasta = hasta ? new Date(hasta) : defaultHasta;

    const result = await db.produccion.aggregate({
      where: {
        ownerId: user.id,
        estado: "ACTIVA",
        fechaProduccion: { gte: fechaDesde, lt: fechaHasta },
      },
      _count: { id: true },
      _sum: { unidades: true, costoTotalProduccion: true },
    });

    return NextResponse.json({
      totalProducciones: result._count.id,
      totalUnidades: result._sum.unidades ?? 0,
      costoTotalMP: result._sum.costoTotalProduccion?.toNumber() ?? 0,
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) return unauthorizedResponse();
    return NextResponse.json(
      { message: "No se pudo obtener el resumen." },
      { status: 500 },
    );
  }
}
