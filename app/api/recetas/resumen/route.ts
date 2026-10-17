import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/api-errors";
import { requireAuthUser } from "@/lib/auth";
import { getRecetasResumen } from "@/lib/receta-service";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await requireAuthUser();
    return NextResponse.json(await getRecetasResumen(user.id));
  } catch (error) {
    return handleRouteError(error);
  }
}
