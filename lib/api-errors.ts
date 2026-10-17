import { NextResponse } from "next/server";
import { UnauthorizedError } from "@/lib/auth";
import {
  ConflictError,
  DomainError,
  InventoryCountOpenError,
  InsufficientStockError,
  NotFoundError,
} from "@/lib/errors";
import { getPrismaErrorResponse } from "@/lib/prisma-errors";
import * as Sentry from "@sentry/nextjs";

export function handleRouteError(error: unknown) {
  if (error instanceof SyntaxError) {
    return NextResponse.json({ message: "El cuerpo JSON no es válido" }, { status: 400 });
  }
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
  if (error instanceof InventoryCountOpenError) {
    return NextResponse.json(
      {
        code: error.code,
        message: error.message,
        tomaId: error.tomaId,
        periodo: error.periodo,
      },
      { status: 409 },
    );
  }
  if (error instanceof ConflictError) {
    return NextResponse.json({ message: error.message }, { status: 409 });
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

  Sentry.captureException(error);

  return NextResponse.json(
    { message: "Ocurrió un error inesperado." },
    { status: 500 },
  );
}
