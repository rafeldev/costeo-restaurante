import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migration = fs.readFileSync(
  path.resolve("prisma/migrations/20261012171000_insumo_catalog_fields/migration.sql"),
  "utf8",
);

describe("migración de CategoriaInsumo", () => {
  it("usa columna temporal, mapea categorías del seed y conserva un fallback seguro", () => {
    expect(migration).toContain('ADD COLUMN "categoriaNueva"');
    expect(migration).toContain("'proteínas'");
    expect(migration).toContain("'lácteos'");
    expect(migration).toContain("'panadería'");
    expect(migration).toContain("'salsas'");
    expect(migration).toContain("ELSE 'ABARROTES_SECOS'");
    expect(migration).toContain("RAISE NOTICE");
    expect(migration).toContain('DROP COLUMN "categoria"');
  });
});
