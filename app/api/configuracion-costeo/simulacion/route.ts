import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/api-errors";
import { requireAuthUser } from "@/lib/auth";
import { obtenerSimulacionCosteo } from "@/lib/configuracion-costeo";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await requireAuthUser();
    const recetaId = new URL(request.url).searchParams.get("recetaId")?.trim();
    if (!recetaId) return NextResponse.json({ message: "Selecciona una receta." }, { status: 400 });
    return NextResponse.json(await obtenerSimulacionCosteo(user.id, recetaId));
  } catch (error) {
    return handleRouteError(error);
  }
}
