import { NextResponse } from "next/server";
import { UnauthorizedError, requireAuthUser, unauthorizedResponse } from "@/lib/auth";
import { registrarProduccionReceta } from "@/lib/inventory";
import { parseNumberInput, producirRecetaSchema } from "@/lib/validation";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  try {
    const user = await requireAuthUser();
    const body = await request.json();
    const parsed = producirRecetaSchema.safeParse({
      unidades: parseNumberInput(body.unidades),
      fechaProduccion: body.fechaProduccion,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { message: "Datos inválidos", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const result = await registrarProduccionReceta({
      ownerId: user.id,
      recetaId: id,
      unidades: parsed.data.unidades,
      fechaProduccion: parsed.data.fechaProduccion
        ? new Date(parsed.data.fechaProduccion)
        : undefined,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return unauthorizedResponse();
    }
    if (error instanceof Error && error.message.includes("no encontrada")) {
      return NextResponse.json({ message: error.message }, { status: 404 });
    }
    if (error instanceof Error) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }
    return NextResponse.json(
      { message: "No se pudo registrar la producción." },
      { status: 500 },
    );
  }
}
