import { NextResponse } from "next/server";
import { UnauthorizedError, requireAuthUser, unauthorizedResponse } from "@/lib/auth";
import { db } from "@/lib/db";
import { decimalToNumber } from "@/lib/serializers";
import type { EstadoProduccion, Prisma } from "@prisma/client";

export const runtime = "nodejs";

function serializeProduccion(p: {
  id: string;
  recetaId: string | null;
  recetaNombre: string;
  unidades: number;
  costoTotalProduccion: { toNumber: () => number };
  estado: string;
  fechaProduccion: Date;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...p,
    costoTotalProduccion: decimalToNumber(p.costoTotalProduccion),
  };
}

export async function GET(request: Request) {
  try {
    const user = await requireAuthUser();
    const { searchParams } = new URL(request.url);

    const where: Prisma.ProduccionWhereInput = { ownerId: user.id };

    const recetaId = searchParams.get("recetaId");
    if (recetaId) where.recetaId = recetaId;

    const estado = searchParams.get("estado");
    if (estado === "ACTIVA" || estado === "ANULADA") {
      where.estado = estado as EstadoProduccion;
    }

    const desde = searchParams.get("desde");
    const hasta = searchParams.get("hasta");
    if (desde || hasta) {
      where.fechaProduccion = {};
      if (desde) where.fechaProduccion.gte = new Date(desde);
      if (hasta) where.fechaProduccion.lte = new Date(hasta);
    }

    const producciones = await db.produccion.findMany({
      where,
      orderBy: { fechaProduccion: "desc" },
    });

    return NextResponse.json(producciones.map(serializeProduccion));
  } catch (error) {
    if (error instanceof UnauthorizedError) return unauthorizedResponse();
    return NextResponse.json(
      { message: "No se pudieron consultar las producciones." },
      { status: 500 },
    );
  }
}
