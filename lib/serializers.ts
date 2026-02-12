import { Prisma } from "@prisma/client";

export function decimalToNumber(value: Prisma.Decimal | number | null): number | null {
  if (value === null) return null;
  if (typeof value === "number") return value;
  return value.toNumber();
}

export function toPlainNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  return Number(value);
}
