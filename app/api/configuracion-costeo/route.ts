import { NextResponse } from "next/server";
import { UnauthorizedError, requireAuthUser, unauthorizedResponse } from "@/lib/auth";
import { db } from "@/lib/db";
import { decimalToNumber } from "@/lib/serializers";
import { configuracionCosteoSchema, parseNumberInput } from "@/lib/validation";

export const runtime = "nodejs";

function serializeConfig(config: Awaited<ReturnType<typeof ensureConfig>>) {
  return {
    ...config,
    overheadPct: decimalToNumber(config.overheadPct),
    margenObjetivoPct: decimalToNumber(config.margenObjetivoPct),
    impuestoPct: decimalToNumber(config.impuestoPct),
    redondeoPrecio: decimalToNumber(config.redondeoPrecio),
  };
}

async function ensureConfig(ownerId: string) {
  const current = await db.configuracionCosteo.findFirst({
    where: { ownerId },
    orderBy: { createdAt: "asc" },
  });

  if (current) return current;

  return db.configuracionCosteo.create({
    data: {
      ownerId,
      overheadPct: 15,
      margenObjetivoPct: 40,
      impuestoPct: 19,
      redondeoPrecio: 100,
    },
  });
}

export async function GET() {
  try {
    const user = await requireAuthUser();
    const config = await ensureConfig(user.id);
    return NextResponse.json(serializeConfig(config));
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return unauthorizedResponse();
    }
    return NextResponse.json(
      { message: "No se pudo consultar la configuracion de costeo." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireAuthUser();
    const existing = await ensureConfig(user.id);
    const body = await request.json();
    const parsed = configuracionCosteoSchema.safeParse({
      overheadPct: parseNumberInput(body.overheadPct),
      margenObjetivoPct: parseNumberInput(body.margenObjetivoPct),
      impuestoPct: parseNumberInput(body.impuestoPct),
      redondeoPrecio: parseNumberInput(body.redondeoPrecio),
    });

    if (!parsed.success) {
      return NextResponse.json(
        { message: "Datos inválidos", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const updated = await db.configuracionCosteo.update({
      where: { id: existing.id },
      data: parsed.data,
    });

    return NextResponse.json(serializeConfig(updated));
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return unauthorizedResponse();
    }
    return NextResponse.json(
      { message: "No se pudo actualizar la configuracion de costeo." },
      { status: 500 },
    );
  }
}
