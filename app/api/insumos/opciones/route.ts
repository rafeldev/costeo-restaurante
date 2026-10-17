import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/api-errors";
import { requireAuthUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { insumoInclude } from "@/lib/insumo-service";
import { serializeInsumo } from "@/lib/insumos";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await requireAuthUser();
    const insumos = await db.insumo.findMany({
      where: { ownerId: user.id, activo: true },
      include: insumoInclude,
      orderBy: { nombre: "asc" },
    });
    return NextResponse.json(insumos.map(serializeInsumo));
  } catch (error) {
    return handleRouteError(error);
  }
}
