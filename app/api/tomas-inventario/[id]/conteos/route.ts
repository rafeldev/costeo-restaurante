import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/api-errors";
import { requireAuthUser } from "@/lib/auth";
import { guardarConteosInventario } from "@/lib/tomas-inventario";
import { conteoInsumoPatchSchema, parseNumberInput } from "@/lib/validation";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireAuthUser();
    const { id } = await context.params;
    const body = (await request.json()) as Record<string, unknown>;
    const parsed = conteoInsumoPatchSchema.safeParse({
      ...body,
      conteos: Array.isArray(body.conteos)
        ? body.conteos.map((raw) => {
            const conteo = raw as Record<string, unknown>;
            return {
              ...conteo,
              stockFisico:
                conteo.stockFisico === null ? null : parseNumberInput(conteo.stockFisico),
            };
          })
        : body.conteos,
    });
    if (!parsed.success) {
      return NextResponse.json(
        { message: "Conteos inválidos.", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }
    await guardarConteosInventario(user.id, id, parsed.data, user.email);
    return NextResponse.json({ guardados: parsed.data.conteos.length });
  } catch (error) {
    return handleRouteError(error);
  }
}
