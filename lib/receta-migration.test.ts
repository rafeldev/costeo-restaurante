import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migration = fs.readFileSync(
  path.resolve("prisma/migrations/20261012200000_receta_catalog_fields/migration.sql"),
  "utf8",
);

describe("migración del catálogo de recetas", () => {
  it("rellena códigos por owner antes de hacerlos obligatorios", () => {
    expect(migration).toContain('PARTITION BY "ownerId"');
    expect(migration).toContain("'RC-' || LPAD");
    expect(migration.indexOf('SET "codigo"')).toBeLessThan(
      migration.indexOf('ALTER COLUMN "codigo" SET NOT NULL'),
    );
  });

  it("mapea tipoProducto y mantiene RecetaInsumo exclusivamente basado en insumos", () => {
    expect(migration).toContain('LOWER("tipoProducto")');
    expect(migration).toContain("ELSE 'PLATOS_FUERTES'");
    expect(migration).toContain('DROP COLUMN "tipoProducto"');
    expect(migration).not.toContain("subRecetaId");
    expect(migration).not.toContain('ALTER COLUMN "insumoId" DROP NOT NULL');
  });
});
