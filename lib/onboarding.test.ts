import { describe, expect, it } from "vitest";
import { ONBOARDING_VERSION, shouldShowOnboarding } from "@/lib/onboarding";

describe("shouldShowOnboarding", () => {
  it("muestra una versión pendiente", () => {
    expect(shouldShowOnboarding(0)).toBe(true);
  });

  it("no muestra la versión ya vista", () => {
    expect(shouldShowOnboarding(ONBOARDING_VERSION)).toBe(false);
  });

  it("no retrocede ante una versión futura", () => {
    expect(shouldShowOnboarding(ONBOARDING_VERSION + 1)).toBe(false);
  });
});
