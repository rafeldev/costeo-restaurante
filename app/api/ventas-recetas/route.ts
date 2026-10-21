import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/api-errors";
import { requireAuthUser } from "@/lib/auth";
import { getMezclaMenu, upsertVentasRecetas } from "@/lib/ventas-service";
import { ventasRecetasPatchSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await requireAuthUser();
    const url = new URL(request.url);
    const periodo = url.searchParams.get("periodo");
    if (!periodo || !/^\d{4}-(0[1-9]|1[0-2])$/.test(periodo)) {
      return NextResponse.json({ message: "El periodo debe tener formato AAAA-MM." }, { status: 400 });
    }
    return NextResponse.json(await getMezclaMenu(user.id, periodo));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireAuthUser();
    const body = (await request.json()) as Record<string, unknown>;
    const parsed = ventasRecetasPatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ message: "Datos inválidos.", issues: parsed.error.flatten() }, { status: 400 });
    }
    await upsertVentasRecetas(user.id, parsed.data);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
