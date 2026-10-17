import { describe, expect, it, vi } from "vitest";

const captured = vi.hoisted(() => ({ options: undefined as unknown }));

vi.mock("next-auth/middleware", () => ({
  withAuth: vi.fn((_handler, options) => {
    captured.options = options;
    return vi.fn();
  }),
}));

await import("./proxy");

type Authorized = (input: {
  req: { nextUrl: { pathname: string } };
  token: object | null;
}) => boolean;

const authorized = (
  captured.options as { callbacks: { authorized: Authorized } }
).callbacks.authorized;

describe("proxy public-route exceptions", () => {
  it.each([
    "/login",
    "/login/ayuda",
    "/privacidad",
    "/terminos",
    "/api/auth/signin",
  ])("permite %s sin token", (pathname) => {
    expect(authorized({ req: { nextUrl: { pathname } }, token: null })).toBe(true);
  });

  it("deja pasar APIs sin token para que el handler entregue el 401 JSON", () => {
    expect(authorized({
      req: { nextUrl: { pathname: "/api/insumos" } },
      token: null,
    })).toBe(true);
  });

  it.each(["/", "/inventario", "/login-malicioso", "/privacidad-extra"])(
    "protege la página no pública %s",
    (pathname) => {
      expect(authorized({ req: { nextUrl: { pathname } }, token: null })).toBe(false);
    },
  );

  it("permite páginas protegidas cuando existe token", () => {
    expect(authorized({ req: { nextUrl: { pathname: "/inventario" } }, token: {} })).toBe(true);
  });
});
