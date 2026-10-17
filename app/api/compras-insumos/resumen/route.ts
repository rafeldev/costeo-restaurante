import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/api-errors";
import { requireAuthUser } from "@/lib/auth";
import { obtenerResumenCompras } from "@/lib/compras-analytics";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await requireAuthUser();
    const mes = new URL(request.url).searchParams.get("mes") ?? new Date().toISOString().slice(0, 7);
    return NextResponse.json(await obtenerResumenCompras(user.id, mes));
  } catch (error) {
    return handleRouteError(error);
  }
}
