import { describe, expect, it } from "vitest";
import { isValidBusinessDate, parseBusinessDate } from "@/lib/business-date";

describe("business dates", () => {
  it.each(["2026-02-29", "2026-02-30", "2026-13-01", "texto"])("rechaza %s", (value) => {
    expect(isValidBusinessDate(value)).toBe(false);
  });

  it("acepta un día real y lo interpreta en Bogotá", () => {
    expect(isValidBusinessDate("2026-02-28")).toBe(true);
    expect(parseBusinessDate("2026-02-28").toISOString()).toBe("2026-02-28T05:00:00.000Z");
  });

  it("acepta fecha y hora ISO", () => {
    expect(parseBusinessDate("2026-10-17T12:30:00.000Z").toISOString()).toBe("2026-10-17T12:30:00.000Z");
  });
});
