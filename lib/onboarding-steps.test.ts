import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ONBOARDING_STEPS, type TourRoute } from "@/lib/onboarding-steps";

const validRoutes = new Set<TourRoute>([
  "/",
  "/configuracion",
  "/insumos",
  "/recetas",
  "/producciones",
]);

describe("ONBOARDING_STEPS", () => {
  it("mantiene identificadores únicos y un recorrido corto", () => {
    const ids = ONBOARDING_STEPS.map((step) => step.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ONBOARDING_STEPS.length).toBeLessThanOrEqual(8);
  });

  it("solo usa rutas soportadas", () => {
    expect(ONBOARDING_STEPS.every((step) => validRoutes.has(step.route))).toBe(true);
  });

  it("mantiene disponibles el primer y último paso en móvil", () => {
    expect(ONBOARDING_STEPS.at(0)?.desktopOnly).not.toBe(true);
    expect(ONBOARDING_STEPS.at(-1)?.desktopOnly).not.toBe(true);
  });

  it("conserva cada ancla declarada en los componentes", () => {
    const componentFiles = [
      "components/MainNav.tsx",
      "components/configuracion/ConfiguracionModule.tsx",
      "components/insumos/InsumosModule.tsx",
      "components/recetas/RecetasModule.tsx",
      "components/producciones/ProduccionesModule.tsx",
    ];
    const source = componentFiles
      .map((file) => readFileSync(join(process.cwd(), file), "utf8"))
      .join("\n");

    for (const step of ONBOARDING_STEPS) {
      if (step.target === "body") continue;
      const anchor = step.target.match(/data-tour="([^"]+)"/)?.[1];
      expect(source, `Falta el ancla ${step.target}`).toContain(`data-tour="${anchor}"`);
    }
  });
});
