import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/api-errors";
import { requireAuthUser } from "@/lib/auth";
import { cerrarTomaInventario } from "@/lib/tomas-inventario";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireAuthUser();
    const { id } = await context.params;
    const forzar = new URL(request.url).searchParams.get("forzar") === "true";
    return NextResponse.json(await cerrarTomaInventario(user.id, id, user.email, forzar));
  } catch (error) {
    return handleRouteError(error);
  }
}
