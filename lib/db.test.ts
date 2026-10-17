import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const constructors = vi.hoisted(() => ({
  pool: vi.fn(),
  adapter: vi.fn(),
  prismaClient: vi.fn(),
}));

vi.mock("pg", () => ({ Pool: constructors.pool }));
vi.mock("@prisma/adapter-pg", () => ({ PrismaPg: constructors.adapter }));
vi.mock("@prisma/client", () => ({ PrismaClient: constructors.prismaClient }));

type PoolOptions = {
  connectionString: string;
  ssl: false | { rejectUnauthorized: boolean };
};

describe("configuración TLS de la base de datos", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    delete (globalThis as typeof globalThis & { prisma?: unknown }).prisma;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    delete (globalThis as typeof globalThis & { prisma?: unknown }).prisma;
  });

  it.each([
    ["localhost", "postgresql://user:pass@localhost:5432/db", false],
    ["127.0.0.1", "postgresql://user:pass@127.0.0.1:5432/db?sslmode=verify-full", false],
    ["sslmode=disable", "postgresql://user:pass@db.example.com:5432/db?sslmode=disable", false],
    ["sin sslmode", "postgresql://user:pass@db.example.com:5432/db", { rejectUnauthorized: false }],
    ["sslmode=require", "postgresql://user:pass@db.example.com:5432/db?sslmode=require", { rejectUnauthorized: false }],
    ["sslmode=no-verify", "postgresql://user:pass@db.example.com:5432/db?sslmode=no-verify", { rejectUnauthorized: false }],
    ["sslmode=verify-ca", "postgresql://user:pass@db.example.com:5432/db?sslmode=verify-ca", { rejectUnauthorized: true }],
    ["sslmode=verify-full", "postgresql://user:pass@db.example.com:5432/db?sslmode=verify-full", { rejectUnauthorized: true }],
    ["otro sslmode", "postgresql://user:pass@db.example.com:5432/db?sslmode=prefer", { rejectUnauthorized: true }],
  ] as const)("usa la política esperada para %s", async (_scenario, databaseUrl, expectedSsl) => {
    vi.stubEnv("DATABASE_URL", databaseUrl);

    await import("./db");

    expect(constructors.pool).toHaveBeenCalledOnce();
    const options = constructors.pool.mock.calls[0][0] as PoolOptions;
    expect(options.ssl).toEqual(expectedSsl);
    expect(new URL(options.connectionString).searchParams.has("sslmode")).toBe(false);
  });
});
