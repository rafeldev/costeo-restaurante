export function hasPrismaErrorCode(error: unknown, code: string): boolean {
  if (!error || typeof error !== "object") return false;
  const maybeCode = (error as { code?: unknown }).code;
  return typeof maybeCode === "string" && maybeCode === code;
}

export function getPrismaErrorResponse(error: unknown) {
  if (hasPrismaErrorCode(error, "P2002")) {
    return { status: 409, message: "Ya existe un registro con esos datos." };
  }
  if (hasPrismaErrorCode(error, "P2003")) {
    return { status: 409, message: "El registro está relacionado con otros datos." };
  }
  if (hasPrismaErrorCode(error, "P2025")) {
    return { status: 404, message: "Registro no encontrado." };
  }
  return null;
}
