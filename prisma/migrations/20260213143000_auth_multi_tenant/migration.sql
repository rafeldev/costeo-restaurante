-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- Seed a legacy owner to preserve existing rows
INSERT INTO "User" ("id", "email", "passwordHash", "createdAt", "updatedAt")
VALUES (
  'legacy_owner',
  'legacy-owner@local.invalid',
  '$2b$12$3Ya2QXhD9FfX9KyjWRJQ7e4KJ7y0h0EhfM6hFvYQ0V7jv06M8VJbq',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("email") DO NOTHING;

-- AlterTable
ALTER TABLE "Insumo" ADD COLUMN "ownerId" TEXT;
ALTER TABLE "Receta" ADD COLUMN "ownerId" TEXT;
ALTER TABLE "Proveedor" ADD COLUMN "ownerId" TEXT;
ALTER TABLE "ConfiguracionCosteo" ADD COLUMN "ownerId" TEXT;

-- Backfill ownerId for existing records
UPDATE "Insumo" SET "ownerId" = 'legacy_owner' WHERE "ownerId" IS NULL;
UPDATE "Receta" SET "ownerId" = 'legacy_owner' WHERE "ownerId" IS NULL;
UPDATE "Proveedor" SET "ownerId" = 'legacy_owner' WHERE "ownerId" IS NULL;
UPDATE "ConfiguracionCosteo" SET "ownerId" = 'legacy_owner' WHERE "ownerId" IS NULL;

-- Keep only one configuration before enforcing one-per-user
WITH ranked_configs AS (
  SELECT "id", ROW_NUMBER() OVER (ORDER BY "createdAt" ASC) AS rn
  FROM "ConfiguracionCosteo"
)
DELETE FROM "ConfiguracionCosteo"
WHERE "id" IN (SELECT "id" FROM ranked_configs WHERE rn > 1);

-- Make ownerId mandatory
ALTER TABLE "Insumo" ALTER COLUMN "ownerId" SET NOT NULL;
ALTER TABLE "Receta" ALTER COLUMN "ownerId" SET NOT NULL;
ALTER TABLE "Proveedor" ALTER COLUMN "ownerId" SET NOT NULL;
ALTER TABLE "ConfiguracionCosteo" ALTER COLUMN "ownerId" SET NOT NULL;

-- Replace global unique constraints with tenant-scoped ones
DROP INDEX IF EXISTS "Insumo_nombre_key";
DROP INDEX IF EXISTS "Proveedor_nombre_key";

CREATE UNIQUE INDEX "Insumo_ownerId_nombre_key" ON "Insumo"("ownerId", "nombre");
CREATE INDEX "Insumo_ownerId_idx" ON "Insumo"("ownerId");
CREATE INDEX "Receta_ownerId_idx" ON "Receta"("ownerId");
CREATE UNIQUE INDEX "Proveedor_ownerId_nombre_key" ON "Proveedor"("ownerId", "nombre");
CREATE INDEX "Proveedor_ownerId_idx" ON "Proveedor"("ownerId");
CREATE UNIQUE INDEX "ConfiguracionCosteo_ownerId_key" ON "ConfiguracionCosteo"("ownerId");

-- AddForeignKey
ALTER TABLE "Insumo"
ADD CONSTRAINT "Insumo_ownerId_fkey"
FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Receta"
ADD CONSTRAINT "Receta_ownerId_fkey"
FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Proveedor"
ADD CONSTRAINT "Proveedor_ownerId_fkey"
FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ConfiguracionCosteo"
ADD CONSTRAINT "ConfiguracionCosteo_ownerId_fkey"
FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
