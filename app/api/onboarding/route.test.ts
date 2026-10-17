import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAuthUser: vi.fn(),
  getOnboardingStatus: vi.fn(),
  markOnboarding: vi.fn(),
}));

vi.mock("@/lib/auth", () => {
  class UnauthorizedError extends Error {
    constructor() {
      super("No autenticado");
    }
  }

  return { UnauthorizedError, requireAuthUser: mocks.requireAuthUser };
});

vi.mock("@/lib/onboarding", () => ({
  getOnboardingStatus: mocks.getOnboardingStatus,
  markOnboarding: mocks.markOnboarding,
}));

import { UnauthorizedError } from "@/lib/auth";
import { GET, PATCH } from "./route";

describe("/api/onboarding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna 401 sin sesión", async () => {
    mocks.requireAuthUser.mockRejectedValue(new UnauthorizedError());

    const response = await GET();

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ message: "No autenticado" });
  });

  it("retorna el estado del usuario autenticado", async () => {
    mocks.requireAuthUser.mockResolvedValue({ id: "owner-1" });
    mocks.getOnboardingStatus.mockResolvedValue({ shouldShow: true, version: 1 });

    const response = await GET();

    expect(response.status).toBe(200);
    expect(mocks.getOnboardingStatus).toHaveBeenCalledWith("owner-1");
    await expect(response.json()).resolves.toEqual({ shouldShow: true, version: 1 });
  });

  it("rechaza un resultado inválido", async () => {
    mocks.requireAuthUser.mockResolvedValue({ id: "owner-1" });
    const request = new Request("http://localhost/api/onboarding", {
      method: "PATCH",
      body: JSON.stringify({ outcome: "later" }),
    });

    const response = await PATCH(request);

    expect(response.status).toBe(400);
    expect(mocks.markOnboarding).not.toHaveBeenCalled();
  });

  it("rechaza JSON malformado", async () => {
    mocks.requireAuthUser.mockResolvedValue({ id: "owner-1" });
    const request = new Request("http://localhost/api/onboarding", {
      method: "PATCH",
      body: "{",
    });

    const response = await PATCH(request);

    expect(response.status).toBe(400);
    expect(mocks.markOnboarding).not.toHaveBeenCalled();
  });

  it("guarda el recorrido completado", async () => {
    mocks.requireAuthUser.mockResolvedValue({ id: "owner-1" });
    const request = new Request("http://localhost/api/onboarding", {
      method: "PATCH",
      body: JSON.stringify({ outcome: "completed" }),
    });

    const response = await PATCH(request);

    expect(response.status).toBe(200);
    expect(mocks.markOnboarding).toHaveBeenCalledWith("owner-1", "completed");
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it("guarda el recorrido omitido", async () => {
    mocks.requireAuthUser.mockResolvedValue({ id: "owner-1" });
    const request = new Request("http://localhost/api/onboarding", {
      method: "PATCH",
      body: JSON.stringify({ outcome: "skipped" }),
    });

    const response = await PATCH(request);

    expect(response.status).toBe(200);
    expect(mocks.markOnboarding).toHaveBeenCalledWith("owner-1", "skipped");
  });
});
