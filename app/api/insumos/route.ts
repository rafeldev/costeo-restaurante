import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/api-errors";
import { requireAuthUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { createInsumo, insumoInclude } from "@/lib/insumo-service";
import { serializeInsumo } from "@/lib/insumos";
import { getPaginationMetadata, normalizePagination } from "@/lib/pagination";
import { insumosQuerySchema, insumoSchema, parseNumberInput } from "@/lib/validation";

export const runtime = "nodejs";

function normalizeBody(body: Record<string, unknown>) {
  return {
    ...body,
    costoUnidad: parseNumberInput(body.costoUnidad),
    mermaPct: parseNumberInput(body.mermaPct),
    presentacionCantidad: parseNumberInput(body.presentacionCantidad) ?? null,
    precioPresentacion: parseNumberInput(body.precioPresentacion) ?? null,
  };
}

export async function GET(request: Request) {
  try {
    const user = await requireAuthUser();
    const url = new URL(request.url);
    const pagination = normalizePagination(url.searchParams);
    const filters = insumosQuerySchema.safeParse({
      categoria: url.searchParams.get("categoria") || undefined,
      proveedorId: url.searchParams.get("proveedorId") || undefined,
    });
    if (!filters.success) {
      return NextResponse.json({ message: "Filtros inválidos." }, { status: 400 });
    }

    const where: Prisma.InsumoWhereInput = {
      ownerId: user.id,
      categoria: filters.data.categoria,
      proveedorPreferidoId: filters.data.proveedorId,
      ...(pagination.q
        ? {
            OR: [
              { nombre: { contains: pagination.q, mode: "insensitive" } },
              { codigo: { contains: pagination.q, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    const total = await db.insumo.count({ where });
    const metadata = getPaginationMetadata(total, pagination);
    const insumos = await db.insumo.findMany({
      where,
      include: insumoInclude,
      orderBy: [{ activo: "desc" }, { nombre: "asc" }],
      skip: (metadata.page - 1) * metadata.pageSize,
      take: metadata.pageSize,
    });
    const items = insumos.map(serializeInsumo);

    return NextResponse.json({
      items,
      total: metadata.total,
      page: metadata.page,
      pageSize: metadata.pageSize,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuthUser();
    const body = (await request.json()) as Record<string, unknown>;
    const parsed = insumoSchema.safeParse(normalizeBody(body));
    if (!parsed.success) {
      return NextResponse.json(
        { message: "Datos inválidos.", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const created = await createInsumo(user.id, parsed.data);
    return NextResponse.json(serializeInsumo(created), { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
