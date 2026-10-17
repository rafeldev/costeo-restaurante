import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/api-errors";
import { requireAuthUser } from "@/lib/auth";
import { getOnboardingStatus, markOnboarding } from "@/lib/onboarding";
import { onboardingOutcomeSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await requireAuthUser();
    return NextResponse.json(await getOnboardingStatus(user.id));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireAuthUser();
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ message: "El cuerpo de la solicitud no es JSON válido." }, { status: 400 });
    }
    const parsed = onboardingOutcomeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { message: "Resultado del recorrido inválido.", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }

    await markOnboarding(user.id, parsed.data.outcome);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
