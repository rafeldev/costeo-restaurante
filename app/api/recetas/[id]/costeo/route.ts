import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/api-errors";
import { requireAuthUser } from "@/lib/auth";
import { calculateRecipeCosting } from "@/lib/pricing/calculateRecipeCosting";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;

  try {
    const user = await requireAuthUser();
    const result = await calculateRecipeCosting(id, user.id);
    return NextResponse.json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
