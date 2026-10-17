import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/api-errors";
import { requireAuthUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { createWithReadableCode, formatReadableCode } from "@/lib/readable-code";
import { proveedorSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await requireAuthUser();
    const url = new URL(request.url);
    const onlyActive = url.searchParams.get("activo") === "true";
    const proveedores = await db.proveedor.findMany({
      where: { ownerId: user.id, activo: onlyActive ? true : undefined },
      orderBy: { nombre: "asc" },
    });
    return NextResponse.json(proveedores);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuthUser();
    const parsed = proveedorSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { message: "Datos inválidos.", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const created = await createWithReadableCode(() =>
      db.$transaction(async (tx) => {
        const [counter] = await tx.$queryRaw<Array<{ max: bigint | null }>>`
          SELECT MAX(CAST(SUBSTRING("codigo" FROM '[0-9]+$') AS BIGINT)) AS max
          FROM "Proveedor"
          WHERE "ownerId" = ${user.id}
        `;
        return tx.proveedor.create({
          data: {
            ownerId: user.id,
            codigo: formatReadableCode(Number(counter?.max ?? 0) + 1, "PROV"),
            nombre: parsed.data.nombre,
            contacto: parsed.data.contacto || null,
            activo: parsed.data.activo,
          },
        });
      }),
    );
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
