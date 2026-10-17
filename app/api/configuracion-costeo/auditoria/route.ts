import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/api-errors";
import { requireAuthUser } from "@/lib/auth";
import { obtenerAuditoriaConfiguracion } from "@/lib/configuracion-costeo";
import { auditoriaConfiguracionQuerySchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await requireAuthUser();
    const parsed = auditoriaConfiguracionQuerySchema.safeParse({
      limit: new URL(request.url).searchParams.get("limit") ?? undefined,
    });
    if (!parsed.success) return NextResponse.json({ message: "Límite inválido." }, { status: 400 });
    return NextResponse.json(await obtenerAuditoriaConfiguracion(user.id, parsed.data.limit));
  } catch (error) {
    return handleRouteError(error);
  }
}
