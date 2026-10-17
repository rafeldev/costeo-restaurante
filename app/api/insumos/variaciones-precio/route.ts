import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/api-errors";
import { requireAuthUser } from "@/lib/auth";
import { obtenerPoliticaVolatilidad, obtenerVariacionesPrecio } from "@/lib/compras-analytics";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await requireAuthUser();
    const horas = Number(new URL(request.url).searchParams.get("horas") ?? 72);
    const politica = await obtenerPoliticaVolatilidad(user.id);
    const items = await obtenerVariacionesPrecio(user.id, horas, politica);
    return NextResponse.json({
      items,
      horas: Number.isFinite(horas) ? horas : 72,
      umbralPct: politica.umbralPct,
      alertaActiva: politica.activa,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
