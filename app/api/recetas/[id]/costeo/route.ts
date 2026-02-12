import { NextResponse } from "next/server";
import { calculateRecipeCosting } from "@/lib/pricing/calculateRecipeCosting";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;

  try {
    const result = await calculateRecipeCosting(id);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message.includes("no encontrada")) {
      return NextResponse.json({ message: error.message }, { status: 404 });
    }
    return NextResponse.json(
      { message: "No se pudo calcular el costeo." },
      { status: 500 },
    );
  }
}
