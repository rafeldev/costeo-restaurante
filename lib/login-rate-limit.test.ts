import { afterEach, describe, expect, it, vi } from "vitest";

describe("allowLoginAttempt without Redis configuration", () => {
  const originalEnvironment = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnvironment };
    vi.resetModules();
  });

  it("permite el acceso sin integración configurada en producción", async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    process.env.VERCEL_ENV = "production";
    vi.resetModules();
    const { allowLoginAttempt } = await import("./login-rate-limit");

    await expect(allowLoginAttempt("owner@example.com", {})).resolves.toBe(true);
  });

  it.each(["development", "preview", undefined])(
    "permite el intento fuera de producción (%s)",
    async (environment) => {
      delete process.env.UPSTASH_REDIS_REST_URL;
      delete process.env.UPSTASH_REDIS_REST_TOKEN;
      if (environment === undefined) delete process.env.VERCEL_ENV;
      else process.env.VERCEL_ENV = environment;
      vi.resetModules();
      const { allowLoginAttempt } = await import("./login-rate-limit");

      await expect(allowLoginAttempt("owner@example.com", {})).resolves.toBe(true);
    },
  );
});
