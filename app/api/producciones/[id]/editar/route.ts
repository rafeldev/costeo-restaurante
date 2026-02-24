import { NextResponse } from "next/server";
import { z } from "zod";
import { UnauthorizedError, requireAuthUser, unauthorizedResponse } from "@/lib/auth";
import { editarProduccion } from "@/lib/inventory";

export const runtime = "nodejs";

const editarSchema = z.object({
  unidades: z.number().int().positive(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  try {
    const user = await requireAuthUser();
    const body = await request.json();
    const parsed = editarSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { message: "Datos inválidos", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const result = await editarProduccion({
      ownerId: user.id,
      produccionId: id,
      nuevasUnidades: parsed.data.unidades,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof UnauthorizedError) return unauthorizedResponse();
    if (error instanceof Error) {
      const status = error.message.includes("no encontrada") ? 404 : 400;
      return NextResponse.json({ message: error.message }, { status });
    }
    return NextResponse.json(
      { message: "No se pudo editar la producción." },
      { status: 500 },
    );
  }
}
