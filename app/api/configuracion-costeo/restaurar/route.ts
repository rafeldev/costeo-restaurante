import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/api-errors";
import { requireAuthUser } from "@/lib/auth";
import { restaurarConfiguracionCosteo, serializeConfiguracion } from "@/lib/configuracion-costeo";

export const runtime = "nodejs";

export async function POST() {
  try {
    const user = await requireAuthUser();
    return NextResponse.json(serializeConfiguracion(await restaurarConfiguracionCosteo(user.id, user.id)));
  } catch (error) {
    return handleRouteError(error);
  }
}
