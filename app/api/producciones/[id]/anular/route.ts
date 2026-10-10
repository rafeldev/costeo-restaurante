import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/api-errors";
import { requireAuthUser } from "@/lib/auth";
import { anularProduccion } from "@/lib/inventory";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  try {
    const user = await requireAuthUser();
    const result = await anularProduccion({ ownerId: user.id, produccionId: id });
    return NextResponse.json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
