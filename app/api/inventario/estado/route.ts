import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/api-errors";
import { requireAuthUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await requireAuthUser();
    const toma = await db.tomaInventario.findFirst({
      where: { ownerId: user.id, estado: "EN_CURSO" },
      select: { id: true, periodo: true },
    });
    return NextResponse.json({ bloqueado: Boolean(toma), tomaId: toma?.id ?? null, periodo: toma?.periodo ?? null });
  } catch (error) {
    return handleRouteError(error);
  }
}
