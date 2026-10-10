import { NextResponse } from "next/server";
import { UnauthorizedError } from "@/lib/auth";
import {
  DomainError,
  InsufficientStockError,
  NotFoundError,
} from "@/lib/errors";
import { getPrismaErrorResponse } from "@/lib/prisma-errors";

export function handleRouteError(error: unknown) {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ message: error.message }, { status: 401 });
  }
  if (error instanceof InsufficientStockError) {
    return NextResponse.json(
      { message: error.message, faltantes: error.faltantes },
      { status: 409 },
    );
  }
  if (error instanceof NotFoundError) {
    return NextResponse.json({ message: error.message }, { status: 404 });
  }
  if (error instanceof DomainError) {
    return NextResponse.json({ message: error.message }, { status: 400 });
  }

  const prismaError = getPrismaErrorResponse(error);
  if (prismaError) {
    return NextResponse.json(
      { message: prismaError.message },
      { status: prismaError.status },
    );
  }

  return NextResponse.json(
    { message: "Ocurrió un error inesperado." },
    { status: 500 },
  );
}
