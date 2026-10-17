import { hasPrismaErrorCode } from "@/lib/prisma-errors";

const MAX_CREATE_ATTEMPTS = 4;

export function getNextReadableCode(codes: string[], prefix: string) {
  const pattern = new RegExp(`^${prefix}-(\\d+)$`);
  const highest = codes.reduce((max, code) => {
    const match = pattern.exec(code);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return formatReadableCode(highest + 1, prefix);
}

export function formatReadableCode(sequence: number, prefix: string) {
  if (!Number.isSafeInteger(sequence) || sequence < 1) {
    throw new RangeError("La secuencia del código debe ser un entero positivo");
  }
  return `${prefix}-${String(sequence).padStart(3, "0")}`;
}

function isCodeCollision(error: unknown) {
  if (!hasPrismaErrorCode(error, "P2002") || !error || typeof error !== "object") return false;
  const target = (error as { meta?: { target?: unknown } }).meta?.target;
  return Array.isArray(target)
    ? target.includes("codigo")
    : typeof target === "string" && target.includes("codigo");
}

export async function createWithReadableCode<T>(
  operation: () => Promise<T>,
): Promise<T> {
  for (let attempt = 1; attempt <= MAX_CREATE_ATTEMPTS; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (!isCodeCollision(error) || attempt === MAX_CREATE_ATTEMPTS) throw error;
    }
  }
  throw new Error("No se pudo generar el código legible");
}
