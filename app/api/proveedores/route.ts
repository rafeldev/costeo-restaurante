import { NextResponse } from "next/server";
import { UnauthorizedError, requireAuthUser, unauthorizedResponse } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasPrismaErrorCode } from "@/lib/prisma-errors";
import { proveedorSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await requireAuthUser();
    const proveedores = await db.proveedor.findMany({
      where: { ownerId: user.id },
      orderBy: { nombre: "asc" },
    });
    return NextResponse.json(proveedores);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return unauthorizedResponse();
    }
    return NextResponse.json(
      { message: "No se pudo consultar proveedores." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuthUser();
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
        ownerId: user.id,
        nombre: parsed.data.nombre,
        contacto: parsed.data.contacto || null,
      },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return unauthorizedResponse();
    }
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
