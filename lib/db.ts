import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const rawConnectionString =
  process.env.DATABASE_URL ??
  "postgresql://johndoe:randompassword@localhost:5432/mydb?schema=public";

const parsedUrl = new URL(rawConnectionString);
const isLocalConnection =
  parsedUrl.hostname === "localhost" || parsedUrl.hostname === "127.0.0.1";
const sslMode = parsedUrl.searchParams.get("sslmode")?.toLowerCase();
parsedUrl.searchParams.delete("sslmode");
const connectionString = parsedUrl.toString();

function resolveSslConfig() {
  if (isLocalConnection || sslMode === "disable") {
    return false;
  }

  // Supabase pooler often requires TLS without certificate verification.
  if (!sslMode || sslMode === "require" || sslMode === "no-verify") {
    return { rejectUnauthorized: false };
  }

  if (sslMode === "verify-ca" || sslMode === "verify-full") {
    return { rejectUnauthorized: true };
  }

  return { rejectUnauthorized: false };
}

const pool = new Pool({
  connectionString,
  ssl: resolveSslConfig(),
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
