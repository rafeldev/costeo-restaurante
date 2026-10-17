import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/api-errors";
import { requireAuthUser } from "@/lib/auth";
import { getDashboard } from "@/lib/dashboard";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await requireAuthUser();
    return NextResponse.json(await getDashboard(user.id));
  } catch (error) {
    return handleRouteError(error);
  }
}
