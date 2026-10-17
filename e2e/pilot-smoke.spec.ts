import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("protege APIs, permite iniciar sesión y carga el dashboard", async ({ page, request }) => {
  const unauthorized = await request.get("/api/dashboard");
  expect(unauthorized.status()).toBe(401);

  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(process.env.SEED_OWNER_EMAIL ?? "pilot@example.com");
  await page.getByLabel("Contraseña").fill(process.env.SEED_OWNER_PASSWORD ?? "pilot-password-123");
  await page.getByRole("button", { name: /entrar al sistema/i }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("heading", { name: "Control de Costos e Inventario" })).toBeVisible();
});

test("login no presenta violaciones críticas de accesibilidad", async ({ page }) => {
  await page.goto("/login");
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((violation) => violation.impact === "critical")).toEqual([]);
});
