import { ValidationError } from "@/lib/errors";

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isValidBusinessDate(value: string) {
  const match = DATE_ONLY.exec(value);
  if (!match) return false;
  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return date.getUTCFullYear() === Number(year) && date.getUTCMonth() === Number(month) - 1 && date.getUTCDate() === Number(day);
}

export function parseBusinessDate(value: string, field = "fecha") {
  if (isValidBusinessDate(value)) return new Date(`${value}T00:00:00-05:00`);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new ValidationError(`La ${field} no es válida`);
  return date;
}
