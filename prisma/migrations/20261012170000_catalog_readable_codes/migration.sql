-- Add readable codes as nullable columns so existing rows can be backfilled safely.
ALTER TABLE "Insumo" ADD COLUMN "codigo" TEXT;
ALTER TABLE "Proveedor" ADD COLUMN "codigo" TEXT;

WITH ranked AS (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "ownerId" ORDER BY "createdAt", "id") AS sequence
  FROM "Insumo"
)
UPDATE "Insumo" AS item
SET "codigo" = 'INS-' || LPAD(ranked.sequence::TEXT, GREATEST(3, LENGTH(ranked.sequence::TEXT)), '0')
FROM ranked
WHERE item."id" = ranked."id";

WITH ranked AS (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "ownerId" ORDER BY "createdAt", "id") AS sequence
  FROM "Proveedor"
)
UPDATE "Proveedor" AS item
SET "codigo" = 'PROV-' || LPAD(ranked.sequence::TEXT, GREATEST(3, LENGTH(ranked.sequence::TEXT)), '0')
FROM ranked
WHERE item."id" = ranked."id";

ALTER TABLE "Insumo" ALTER COLUMN "codigo" SET NOT NULL;
ALTER TABLE "Proveedor" ALTER COLUMN "codigo" SET NOT NULL;

CREATE UNIQUE INDEX "Insumo_ownerId_codigo_key" ON "Insumo"("ownerId", "codigo");
CREATE UNIQUE INDEX "Proveedor_ownerId_codigo_key" ON "Proveedor"("ownerId", "codigo");
