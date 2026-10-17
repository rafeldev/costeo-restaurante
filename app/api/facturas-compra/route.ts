import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/api-errors";
import { requireAuthUser } from "@/lib/auth";
import {
  crearFacturaCompra,
  listarFacturasCompra,
  serializeFacturaCompra,
} from "@/lib/facturas-compra";
import { facturaCompraSchema, parseNumberInput } from "@/lib/validation";

export const runtime = "nodejs";

function normalizeBody(body: Record<string, unknown>) {
  return {
    ...body,
    lineas: Array.isArray(body.lineas)
      ? body.lineas.map((linea) => {
          const item = linea as Record<string, unknown>;
          return {
            ...item,
            cantidad: parseNumberInput(item.cantidad),
            precioUnitarioBruto: parseNumberInput(item.precioUnitarioBruto),
            tasaImpuestoPct: parseNumberInput(item.tasaImpuestoPct),
          };
        })
      : body.lineas,
  };
}

export async function GET(request: Request) {
  try {
    const user = await requireAuthUser();
    const result = await listarFacturasCompra(user.id, new URL(request.url).searchParams);
    return NextResponse.json({ ...result, items: result.items.map(serializeFacturaCompra) });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuthUser();
    const body = (await request.json()) as Record<string, unknown>;
    const parsed = facturaCompraSchema.safeParse(normalizeBody(body));
    if (!parsed.success) {
      return NextResponse.json(
        { message: "Datos de factura inválidos.", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const factura = await crearFacturaCompra(user.id, parsed.data);
    return NextResponse.json(serializeFacturaCompra(factura), { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
