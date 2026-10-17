CREATE TYPE "RegimenTributario" AS ENUM ('IMPOCONSUMO_8', 'IVA_19', 'EXENTO');

ALTER TABLE "ConfiguracionCosteo"
  ALTER COLUMN "overheadPct" SET DEFAULT 12,
  ALTER COLUMN "margenObjetivoPct" SET DEFAULT 56.2,
  ALTER COLUMN "impuestoPct" SET DEFAULT 8,
  ADD COLUMN "regimenTributario" "RegimenTributario" NOT NULL DEFAULT 'IMPOCONSUMO_8',
  ADD COLUMN "foodCostCriticoPct" DECIMAL(5,2) NOT NULL DEFAULT 35,
  ADD COLUMN "margenMinimoPct" DECIMAL(5,2) NOT NULL DEFAULT 40,
  ADD COLUMN "alertaVolatilidadActiva" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "umbralVolatilidadPct" DECIMAL(5,2) NOT NULL DEFAULT 15;

-- Preserve existing tax choices while establishing the regime as their source of truth.
UPDATE "ConfiguracionCosteo"
SET "regimenTributario" = CASE
  WHEN "impuestoPct" = 19 THEN 'IVA_19'::"RegimenTributario"
  WHEN "impuestoPct" = 8 THEN 'IMPOCONSUMO_8'::"RegimenTributario"
  ELSE 'EXENTO'::"RegimenTributario"
END,
"impuestoPct" = CASE
  WHEN "impuestoPct" = 19 THEN 19
  WHEN "impuestoPct" = 8 THEN 8
  ELSE 0
END;

ALTER TABLE "ConfiguracionCosteo" ADD CONSTRAINT "ConfiguracionCosteo_regimen_impuesto_check" CHECK (
  ("regimenTributario" = 'IMPOCONSUMO_8' AND "impuestoPct" = 8) OR
  ("regimenTributario" = 'IVA_19' AND "impuestoPct" = 19) OR
  ("regimenTributario" = 'EXENTO' AND "impuestoPct" = 0)
);

CREATE TABLE "ConfiguracionCosteoAuditoria" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "campo" TEXT NOT NULL,
  "valorAnterior" TEXT NOT NULL,
  "valorNuevo" TEXT NOT NULL,
  "usuarioId" TEXT NOT NULL,
  "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ConfiguracionCosteoAuditoria_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ConfiguracionCosteoAuditoria_ownerId_creadoEn_idx" ON "ConfiguracionCosteoAuditoria"("ownerId", "creadoEn");
CREATE INDEX "ConfiguracionCosteoAuditoria_usuarioId_idx" ON "ConfiguracionCosteoAuditoria"("usuarioId");

ALTER TABLE "ConfiguracionCosteoAuditoria" ADD CONSTRAINT "ConfiguracionCosteoAuditoria_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConfiguracionCosteoAuditoria" ADD CONSTRAINT "ConfiguracionCosteoAuditoria_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
