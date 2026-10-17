import { describe, expect, it } from "vitest";
import {
  omitPendingDeletes,
  removeOptimistically,
  restoreOptimistically,
} from "./optimistic-delete";

const page = {
  items: [{ id: "a" }, { id: "b" }, { id: "c" }],
  total: 5,
  page: 1,
  pageSize: 3,
};

describe("optimistic delete state", () => {
  it("removes the row and total immediately while preserving pagination metadata", () => {
    const { next, snapshot } = removeOptimistically(page, "b");

    expect(next).toEqual({
      items: [{ id: "a" }, { id: "c" }],
      total: 4,
      page: 1,
      pageSize: 3,
    });
    expect(snapshot?.item.id).toBe("b");
  });

  it("restores at the original relative position after another concurrent deletion", () => {
    const first = removeOptimistically(page, "b");
    const second = removeOptimistically(first.next, "a");

    const restored = restoreOptimistically(second.next, first.snapshot!);

    expect(restored.items.map((item) => item.id)).toEqual(["b", "c"]);
    expect(restored.total).toBe(4);
  });

  it("does not duplicate a row or inflate the total if a refresh already restored it", () => {
    const { snapshot } = removeOptimistically(page, "b");

    expect(restoreOptimistically(page, snapshot!)).toBe(page);
  });

  it("keeps pending rows hidden when a catalog response races the delete", () => {
    const result = omitPendingDeletes(page, new Set(["b", "missing"]));

    expect(result.items.map((item) => item.id)).toEqual(["a", "c"]);
    expect(result.total).toBe(4);
  });
});
