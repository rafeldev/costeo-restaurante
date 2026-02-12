export function hasPrismaErrorCode(error: unknown, code: string): boolean {
  if (!error || typeof error !== "object") return false;
  const maybeCode = (error as { code?: unknown }).code;
  return typeof maybeCode === "string" && maybeCode === code;
}
