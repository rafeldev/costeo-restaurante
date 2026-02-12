import { NextResponse } from "next/server";
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

async function ensureConfig() {
  const current = await db.configuracionCosteo.findFirst({
    orderBy: { createdAt: "asc" },
  });

  if (current) return current;

  return db.configuracionCosteo.create({
    data: {
      overheadPct: 15,
      margenObjetivoPct: 40,
      impuestoPct: 19,
      redondeoPrecio: 100,
    },
  });
}

export async function GET() {
  const config = await ensureConfig();
  return NextResponse.json(serializeConfig(config));
}

export async function PATCH(request: Request) {
  const existing = await ensureConfig();
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
}
