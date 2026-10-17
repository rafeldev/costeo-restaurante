import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/api-errors";
import { requireAuthUser } from "@/lib/auth";
import { abrirTomaInventario, listarTomasInventario } from "@/lib/tomas-inventario";
import { abrirTomaInventarioSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await requireAuthUser();
    return NextResponse.json(
      await listarTomasInventario(user.id, new URL(request.url).searchParams),
    );
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuthUser();
    const parsed = abrirTomaInventarioSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { message: "Datos de apertura inválidos.", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const toma = await abrirTomaInventario(user.id, parsed.data);
    return NextResponse.json(toma, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
