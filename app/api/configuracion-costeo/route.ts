import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/api-errors";
import { requireAuthUser } from "@/lib/auth";
import {
  actualizarConfiguracionCosteo,
  ensureConfiguracionCosteo,
  serializeConfiguracion,
} from "@/lib/configuracion-costeo";
import { configuracionCosteoPatchSchema, parseNumberInput } from "@/lib/validation";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await requireAuthUser();
    return NextResponse.json(serializeConfiguracion(await ensureConfiguracionCosteo(user.id)));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireAuthUser();
    const body = (await request.json()) as Record<string, unknown>;
    const numericFields = ["overheadPct", "margenObjetivoPct", "redondeoPrecio", "foodCostCriticoPct", "margenMinimoPct", "umbralVolatilidadPct", "toleranciaInventarioPct", "criticoInventarioPct"];
    const normalized = { ...body };
    for (const field of numericFields) {
      if (field in body) normalized[field] = parseNumberInput(body[field]);
    }
    const parsed = configuracionCosteoPatchSchema.safeParse(normalized);

    if (!parsed.success) {
      return NextResponse.json(
        { message: "Datos inválidos", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const updated = await actualizarConfiguracionCosteo(user.id, user.id, parsed.data);
    return NextResponse.json(serializeConfiguracion(updated));
  } catch (error) {
    return handleRouteError(error);
  }
}
