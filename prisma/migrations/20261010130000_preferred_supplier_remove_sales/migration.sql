DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Venta" LIMIT 1)
     OR EXISTS (SELECT 1 FROM "VentaItem" LIMIT 1)
     OR EXISTS (
       SELECT 1
       FROM "MovimientoInventario"
       WHERE "referenciaVentaId" IS NOT NULL
       LIMIT 1
     ) THEN
    RAISE EXCEPTION 'La migración no puede eliminar Ventas mientras existan datos. Expórtelos antes de continuar.';
  END IF;
END $$;

ALTER TABLE "Insumo" ADD COLUMN "proveedorPreferidoId" TEXT;

INSERT INTO "Proveedor" ("id", "ownerId", "nombre", "createdAt", "updatedAt")
SELECT
  CONCAT('backfill_', MD5("ownerId" || ':' || BTRIM("proveedor"))),
  "ownerId",
  BTRIM("proveedor"),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Insumo"
WHERE "proveedor" IS NOT NULL AND BTRIM("proveedor") <> ''
ON CONFLICT ("ownerId", "nombre") DO NOTHING;

UPDATE "Insumo" AS i
SET "proveedorPreferidoId" = p."id"
FROM "Proveedor" AS p
WHERE p."ownerId" = i."ownerId"
  AND p."nombre" = BTRIM(i."proveedor")
  AND i."proveedor" IS NOT NULL
  AND BTRIM(i."proveedor") <> '';

CREATE INDEX "Insumo_proveedorPreferidoId_idx" ON "Insumo"("proveedorPreferidoId");
ALTER TABLE "Insumo"
  ADD CONSTRAINT "Insumo_proveedorPreferidoId_fkey"
  FOREIGN KEY ("proveedorPreferidoId") REFERENCES "Proveedor"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Insumo" DROP COLUMN "proveedor";

ALTER TABLE "MovimientoInventario"
  DROP CONSTRAINT "MovimientoInventario_referenciaVentaId_fkey";
DROP INDEX "MovimientoInventario_referenciaVentaId_idx";
ALTER TABLE "MovimientoInventario" DROP COLUMN "referenciaVentaId";
DROP TABLE "VentaItem";
DROP TABLE "Venta";
DROP TYPE "EstadoVenta";
