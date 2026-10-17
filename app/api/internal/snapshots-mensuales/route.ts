import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { captureMonthlyCostingSnapshot, previousMonthlyPeriod } from "@/lib/monthly-snapshots";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ message: "No autorizado" }, { status: 401 });
  }
  const periodo = previousMonthlyPeriod();
  const owners = await db.user.findMany({ select: { id: true } });
  const results = [];
  for (const owner of owners) {
    results.push(await captureMonthlyCostingSnapshot(owner.id, periodo));
  }
  return NextResponse.json({
    periodo,
    procesados: results.length,
    capturados: results.filter((result) => result.status === "captured").length,
  });
}
