import { NextResponse } from "next/server";
import { z } from "zod";
import { handleRouteError } from "@/lib/api-errors";
import { requireAuthUser } from "@/lib/auth";
import { categoriaInsumoValues } from "@/lib/domain";
import { obtenerTomaInventario } from "@/lib/tomas-inventario";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

const querySchema = z.object({
  familia: z.enum(categoriaInsumoValues).optional(),
  soloDiscrepancia: z.enum(["true", "false"]).optional(),
});

export async function GET(request: Request, context: RouteContext) {
  try {
    const user = await requireAuthUser();
    const { id } = await context.params;
    const searchParams = new URL(request.url).searchParams;
    const parsed = querySchema.safeParse({
      familia: searchParams.get("familia") || undefined,
      soloDiscrepancia: searchParams.get("soloDiscrepancia") || undefined,
    });
    if (!parsed.success) {
      return NextResponse.json({ message: "Filtros inválidos." }, { status: 400 });
    }
    return NextResponse.json(await obtenerTomaInventario(user.id, id, searchParams));
  } catch (error) {
    return handleRouteError(error);
  }
}
