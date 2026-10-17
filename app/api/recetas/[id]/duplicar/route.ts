import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/api-errors";
import { requireAuthUser } from "@/lib/auth";
import { duplicateReceta, serializeReceta } from "@/lib/receta-service";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  try {
    const user = await requireAuthUser();
    const { id } = await context.params;
    return NextResponse.json(serializeReceta(await duplicateReceta(user.id, id)), { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
