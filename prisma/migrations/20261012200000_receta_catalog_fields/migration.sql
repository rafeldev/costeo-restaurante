-- Add nullable fields first so existing recipes can be backfilled without downtime.
CREATE TYPE "CategoriaReceta" AS ENUM (
  'HAMBURGUESAS',
  'ENTRADAS_TAPAS',
  'PLATOS_FUERTES',
  'PASTAS_PIZZAS',
  'COCTELERIA_BARRA',
  'POSTRES'
);

ALTER TABLE "Receta" ADD COLUMN "codigo" TEXT;
ALTER TABLE "Receta" ADD COLUMN "categoria" "CategoriaReceta";
ALTER TABLE "Receta" ADD COLUMN "borrador" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Receta" ADD COLUMN "activa" BOOLEAN NOT NULL DEFAULT true;

WITH ranked AS (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "ownerId" ORDER BY "createdAt", "id") AS sequence
  FROM "Receta"
)
UPDATE "Receta" AS item
SET "codigo" = 'RC-' || LPAD(ranked.sequence::TEXT, GREATEST(3, LENGTH(ranked.sequence::TEXT)), '0')
FROM ranked
WHERE item."id" = ranked."id";

UPDATE "Receta"
SET "categoria" = CASE
  WHEN LOWER("tipoProducto") ~ 'hamburg|burger' THEN 'HAMBURGUESAS'::"CategoriaReceta"
  WHEN LOWER("tipoProducto") ~ 'entrada|tapa|aperitivo' THEN 'ENTRADAS_TAPAS'::"CategoriaReceta"
  WHEN LOWER("tipoProducto") ~ 'pasta|pizza' THEN 'PASTAS_PIZZAS'::"CategoriaReceta"
  WHEN LOWER("tipoProducto") ~ 'coct|bebida|barra' THEN 'COCTELERIA_BARRA'::"CategoriaReceta"
  WHEN LOWER("tipoProducto") ~ 'postre|dulce' THEN 'POSTRES'::"CategoriaReceta"
  ELSE 'PLATOS_FUERTES'::"CategoriaReceta"
END;

ALTER TABLE "Receta" ALTER COLUMN "codigo" SET NOT NULL;
ALTER TABLE "Receta" ALTER COLUMN "categoria" SET NOT NULL;
ALTER TABLE "Receta" DROP COLUMN "tipoProducto";

CREATE UNIQUE INDEX "Receta_ownerId_codigo_key" ON "Receta"("ownerId", "codigo");
CREATE INDEX "Receta_ownerId_categoria_activa_idx" ON "Receta"("ownerId", "categoria", "activa");
