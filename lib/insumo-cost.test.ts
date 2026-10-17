import { describe, expect, it } from "vitest";
import { calculateWasteCost, calculateYieldPct } from "@/lib/unit-conversion";

describe("costeo por rendimiento de insumos", () => {
  it("calcula costo neto real y rendimiento", () => {
    expect(calculateWasteCost(0.009, 15)).toBeCloseTo(0.010588, 6);
    expect(calculateYieldPct(15)).toBe(85);
  });

  it("rechaza una merma total", () => {
    expect(() => calculateWasteCost(10, 100)).toThrow(RangeError);
    expect(() => calculateYieldPct(100)).toThrow(RangeError);
  });
});
