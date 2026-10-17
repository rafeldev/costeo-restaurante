import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/api-errors";
import { requireAuthUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { decimalToNumber } from "@/lib/serializers";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await requireAuthUser();
    const [activos, merma, proveedores, compras] = await Promise.all([
      db.insumo.count({ where: { ownerId: user.id, activo: true } }),
      db.insumo.aggregate({
        where: { ownerId: user.id, activo: true },
        _avg: { mermaPct: true },
      }),
      db.proveedor.findMany({
        where: { ownerId: user.id, activo: true },
        select: { id: true },
      }),
      db.compraInsumo.findMany({
        where: {
          proveedor: { ownerId: user.id, activo: true },
          proveedorId: { not: null },
        },
        select: { proveedorId: true, insumoId: true, costoUnitarioCalculado: true },
        orderBy: { fechaCompra: "desc" },
      }),
    ]);

    const latestCosts = new Map<string, number>();
    const variedProviders = new Set<string>();
    for (const compra of compras) {
      if (!compra.proveedorId) continue;
      const key = `${compra.proveedorId}:${compra.insumoId}`;
      const cost = decimalToNumber(compra.costoUnitarioCalculado) ?? 0;
      const latest = latestCosts.get(key);
      if (latest === undefined) latestCosts.set(key, cost);
      else if (latest !== cost) variedProviders.add(compra.proveedorId);
    }

    return NextResponse.json({
      activos,
      mermaPromedioPct: decimalToNumber(merma._avg.mermaPct) ?? 0,
      proveedoresActivos: proveedores.length,
      proveedoresConVariacion: variedProviders.size,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
