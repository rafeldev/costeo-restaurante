import { NextResponse } from "next/server";
import { UnauthorizedError, requireAuthUser, unauthorizedResponse } from "@/lib/auth";
import { anularProduccion } from "@/lib/inventory";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  try {
    const user = await requireAuthUser();
    const result = await anularProduccion({ ownerId: user.id, produccionId: id });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof UnauthorizedError) return unauthorizedResponse();
    if (error instanceof Error) {
      const status = error.message.includes("no encontrada") ? 404 : 400;
      return NextResponse.json({ message: error.message }, { status });
    }
    return NextResponse.json(
      { message: "No se pudo anular la producción." },
      { status: 500 },
    );
  }
}
