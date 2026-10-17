CREATE TYPE "EstadoToma" AS ENUM ('EN_CURSO', 'CERRADA');
CREATE TYPE "MotivoVarianza" AS ENUM ('SOBREPORCIONADO', 'MERMA_EXTRA', 'VENTA_NO_REGISTRADA', 'DETERIORO', 'ERROR_CONTEO', 'OTRO');

ALTER TABLE "Insumo" ADD COLUMN "sku" TEXT;
ALTER TABLE "Insumo" ADD COLUMN "areaId" TEXT;
ALTER TABLE "ConfiguracionCosteo" ADD COLUMN "toleranciaInventarioPct" DECIMAL(5,2) NOT NULL DEFAULT 2;
ALTER TABLE "ConfiguracionCosteo" ADD COLUMN "criticoInventarioPct" DECIMAL(5,2) NOT NULL DEFAULT 5;

CREATE TABLE "AreaAlmacen" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "nombre" TEXT NOT NULL,
  "orden" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "AreaAlmacen_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TomaInventario" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "periodo" TEXT NOT NULL,
  "estado" "EstadoToma" NOT NULL DEFAULT 'EN_CURSO',
  "observaciones" TEXT,
  "firmadoPor" TEXT,
  "abiertaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "cerradaEn" TIMESTAMP(3),
  CONSTRAINT "TomaInventario_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ConteoInsumo" (
  "id" TEXT NOT NULL,
  "tomaId" TEXT NOT NULL,
  "insumoId" TEXT NOT NULL,
  "stockTeorico" DECIMAL(14,4) NOT NULL,
  "costoUnitario" DECIMAL(14,4) NOT NULL,
  "stockFisico" DECIMAL(14,4),
  "contadoPor" TEXT,
  "contadoEn" TIMESTAMP(3),
  "motivo" "MotivoVarianza",
  "nota" TEXT,
  CONSTRAINT "ConteoInsumo_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Insumo_ownerId_sku_key" ON "Insumo"("ownerId", "sku");
CREATE INDEX "Insumo_areaId_idx" ON "Insumo"("areaId");
CREATE UNIQUE INDEX "AreaAlmacen_ownerId_nombre_key" ON "AreaAlmacen"("ownerId", "nombre");
CREATE INDEX "AreaAlmacen_ownerId_orden_idx" ON "AreaAlmacen"("ownerId", "orden");
CREATE UNIQUE INDEX "TomaInventario_ownerId_periodo_key" ON "TomaInventario"("ownerId", "periodo");
CREATE INDEX "TomaInventario_ownerId_estado_abiertaEn_idx" ON "TomaInventario"("ownerId", "estado", "abiertaEn");
CREATE UNIQUE INDEX "TomaInventario_ownerId_en_curso_key" ON "TomaInventario"("ownerId") WHERE "estado" = 'EN_CURSO';
CREATE UNIQUE INDEX "ConteoInsumo_tomaId_insumoId_key" ON "ConteoInsumo"("tomaId", "insumoId");
CREATE INDEX "ConteoInsumo_tomaId_idx" ON "ConteoInsumo"("tomaId");
CREATE INDEX "ConteoInsumo_insumoId_idx" ON "ConteoInsumo"("insumoId");

ALTER TABLE "AreaAlmacen" ADD CONSTRAINT "AreaAlmacen_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TomaInventario" ADD CONSTRAINT "TomaInventario_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConteoInsumo" ADD CONSTRAINT "ConteoInsumo_tomaId_fkey" FOREIGN KEY ("tomaId") REFERENCES "TomaInventario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConteoInsumo" ADD CONSTRAINT "ConteoInsumo_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "Insumo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Insumo" ADD CONSTRAINT "Insumo_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "AreaAlmacen"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "AreaAlmacen" ("id", "ownerId", "nombre", "orden")
SELECT u."id" || '-area-camara-fria', u."id", 'Cámara Fría', 1 FROM "User" u
UNION ALL
SELECT u."id" || '-area-bodega-seca', u."id", 'Bodega Seca', 2 FROM "User" u
UNION ALL
SELECT u."id" || '-area-barra', u."id", 'Barra', 3 FROM "User" u
UNION ALL
SELECT u."id" || '-area-cocina-caliente', u."id", 'Cocina Caliente', 4 FROM "User" u;

UPDATE "Insumo" i
SET "areaId" = CASE
  WHEN i."categoria" IN ('PROTEINAS_CARNES', 'LACTEOS_QUESOS', 'FRUTAS_VERDURAS') THEN i."ownerId" || '-area-camara-fria'
  WHEN i."categoria" = 'BEBIDAS_LICORES' THEN i."ownerId" || '-area-barra'
  WHEN i."categoria" IN ('ABARROTES_SECOS', 'EMPAQUES_DESECHABLES') THEN i."ownerId" || '-area-bodega-seca'
  ELSE i."ownerId" || '-area-cocina-caliente'
END;
