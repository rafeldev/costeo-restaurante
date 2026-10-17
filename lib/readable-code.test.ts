import { describe, expect, it } from "vitest";
import {
  createWithReadableCode,
  formatReadableCode,
  getNextReadableCode,
} from "@/lib/readable-code";

describe("getNextReadableCode", () => {
  it("genera el primer código con relleno", () => {
    expect(getNextReadableCode([], "INS")).toBe("INS-001");
  });

  it("usa el máximo numérico aunque existan huecos y más de tres dígitos", () => {
    expect(getNextReadableCode(["INS-001", "INS-009", "INS-1000", "OTRO-9999"], "INS"))
      .toBe("INS-1001");
    expect(formatReadableCode(7, "PROV")).toBe("PROV-007");
  });

  it("reintenta una colisión del código y no oculta otras restricciones únicas", async () => {
    let attempts = 0;
    const result = await createWithReadableCode(async () => {
      attempts += 1;
      if (attempts === 1) {
        throw Object.assign(new Error("collision"), {
          code: "P2002",
          meta: { target: ["ownerId", "codigo"] },
        });
      }
      return "creado";
    });
    expect(result).toBe("creado");
    expect(attempts).toBe(2);

    await expect(createWithReadableCode(async () => {
      throw Object.assign(new Error("duplicate name"), {
        code: "P2002",
        meta: { target: ["ownerId", "nombre"] },
      });
    })).rejects.toThrow("duplicate name");
  });
});
