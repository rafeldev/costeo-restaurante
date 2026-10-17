import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const rawConnectionString = process.env.DATABASE_URL ??
  (process.env.NODE_ENV === "test"
    ? "postgresql://test:test@localhost:5432/test?schema=public"
    : undefined);
if (!rawConnectionString) {
  throw new Error("DATABASE_URL es obligatoria");
}

const parsedUrl = new URL(rawConnectionString);
const isLocalConnection =
  parsedUrl.hostname === "localhost" || parsedUrl.hostname === "127.0.0.1";
const sslMode = parsedUrl.searchParams.get("sslmode")?.toLowerCase();
parsedUrl.searchParams.delete("sslmode");
const connectionString = parsedUrl.toString();

function resolveSslConfig(): false | { rejectUnauthorized: boolean } {
  if (isLocalConnection || sslMode === "disable") {
    return false;
  }

  if (!sslMode || sslMode === "require" || sslMode === "no-verify") {
    return { rejectUnauthorized: false };
  }

  return { rejectUnauthorized: true };
}

const pool = new Pool({
  connectionString,
  ssl: resolveSslConfig(),
  max: Number(process.env.DATABASE_POOL_MAX ?? 5),
  connectionTimeoutMillis: 10_000,
  idleTimeoutMillis: 10_000,
  allowExitOnIdle: true,
});
const adapter = new PrismaPg(pool);

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
