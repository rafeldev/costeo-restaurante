import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/api-errors";
import { requireAuthUser } from "@/lib/auth";
import {
  actualizarFacturaCompra,
  eliminarFacturaCompra,
  obtenerFacturaCompra,
  serializeFacturaCompra,
} from "@/lib/facturas-compra";
import { facturaCompraPatchSchema, parseNumberInput } from "@/lib/validation";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

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

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireAuthUser();
    const { id } = await context.params;
    return NextResponse.json(serializeFacturaCompra(await obtenerFacturaCompra(user.id, id)));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireAuthUser();
    const { id } = await context.params;
    const parsed = facturaCompraPatchSchema.safeParse(
      normalizeBody((await request.json()) as Record<string, unknown>),
    );
    if (!parsed.success) {
      return NextResponse.json(
        { message: "Datos de factura inválidos.", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }
    return NextResponse.json(
      serializeFacturaCompra(await actualizarFacturaCompra(user.id, id, parsed.data)),
    );
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await requireAuthUser();
    const { id } = await context.params;
    await eliminarFacturaCompra(user.id, id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleRouteError(error);
  }
}
