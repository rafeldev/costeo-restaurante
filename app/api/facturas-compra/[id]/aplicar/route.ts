import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/api-errors";
import { requireAuthUser } from "@/lib/auth";
import { aplicarFacturaCompra, serializeFacturaCompra } from "@/lib/facturas-compra";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  try {
    const user = await requireAuthUser();
    const { id } = await context.params;
    return NextResponse.json(serializeFacturaCompra(await aplicarFacturaCompra(user.id, id)));
  } catch (error) {
    return handleRouteError(error);
  }
}
