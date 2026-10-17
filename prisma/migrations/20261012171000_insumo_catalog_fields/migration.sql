CREATE TYPE "CategoriaInsumo" AS ENUM (
  'PROTEINAS_CARNES',
  'LACTEOS_QUESOS',
  'FRUTAS_VERDURAS',
  'ABARROTES_SECOS',
  'EMPAQUES_DESECHABLES',
  'BEBIDAS_LICORES'
);

ALTER TABLE "Insumo"
  ADD COLUMN "categoriaNueva" "CategoriaInsumo",
  ADD COLUMN "presentacionCantidad" DECIMAL(12,4),
  ADD COLUMN "presentacionUnidad" "UnidadBase",
  ADD COLUMN "precioPresentacion" DECIMAL(12,2),
  ADD COLUMN "activo" BOOLEAN NOT NULL DEFAULT true;

DO $$
DECLARE unmapped TEXT;
BEGIN
  SELECT STRING_AGG(DISTINCT "categoria", ', ' ORDER BY "categoria") INTO unmapped
  FROM "Insumo"
  WHERE LOWER(TRIM("categoria")) NOT IN (
    'proteínas', 'proteinas', 'proteínas y carnes', 'proteinas y carnes', 'carnes',
    'lácteos', 'lacteos', 'lácteos y quesos', 'lacteos y quesos',
    'frutas', 'verduras', 'frutas y verduras',
    'empaque', 'empaques', 'empaques y desechables',
    'bebidas', 'licores', 'bebidas y licores',
    'abarrotes', 'abarrotes y secos', 'panadería', 'panaderia', 'salsas'
  );
  IF unmapped IS NOT NULL THEN
    RAISE NOTICE 'Categorías de insumo asignadas a ABARROTES_SECOS para revisión manual: %', unmapped;
  END IF;
END $$;

UPDATE "Insumo"
SET "categoriaNueva" = CASE
  WHEN LOWER(TRIM("categoria")) IN ('proteínas', 'proteinas', 'proteínas y carnes', 'proteinas y carnes', 'carnes') THEN 'PROTEINAS_CARNES'::"CategoriaInsumo"
  WHEN LOWER(TRIM("categoria")) IN ('lácteos', 'lacteos', 'lácteos y quesos', 'lacteos y quesos') THEN 'LACTEOS_QUESOS'::"CategoriaInsumo"
  WHEN LOWER(TRIM("categoria")) IN ('frutas', 'verduras', 'frutas y verduras') THEN 'FRUTAS_VERDURAS'::"CategoriaInsumo"
  WHEN LOWER(TRIM("categoria")) IN ('empaque', 'empaques', 'empaques y desechables') THEN 'EMPAQUES_DESECHABLES'::"CategoriaInsumo"
  WHEN LOWER(TRIM("categoria")) IN ('bebidas', 'licores', 'bebidas y licores') THEN 'BEBIDAS_LICORES'::"CategoriaInsumo"
  ELSE 'ABARROTES_SECOS'::"CategoriaInsumo"
END;

ALTER TABLE "Insumo" ALTER COLUMN "categoriaNueva" SET NOT NULL;
ALTER TABLE "Insumo" DROP COLUMN "categoria";
ALTER TABLE "Insumo" RENAME COLUMN "categoriaNueva" TO "categoria";

ALTER TABLE "Proveedor"
  ADD COLUMN "activo" BOOLEAN NOT NULL DEFAULT true;
