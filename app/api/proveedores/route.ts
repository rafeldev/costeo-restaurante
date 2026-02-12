import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hasPrismaErrorCode } from "@/lib/prisma-errors";
import { proveedorSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function GET() {
  const proveedores = await db.proveedor.findMany({
    orderBy: { nombre: "asc" },
  });
  return NextResponse.json(proveedores);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = proveedorSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { message: "Datos inválidos", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const created = await db.proveedor.create({
      data: {
        nombre: parsed.data.nombre,
        contacto: parsed.data.contacto || null,
      },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (hasPrismaErrorCode(error, "P2002")) {
      return NextResponse.json(
        { message: "Ya existe un proveedor con ese nombre." },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { message: "No se pudo crear el proveedor." },
      { status: 500 },
    );
  }
}
