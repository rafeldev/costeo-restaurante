-- DropIndex
DROP INDEX "Receta_ownerId_idx";

-- CreateTable
CREATE TABLE "VentaReceta" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "recetaId" TEXT NOT NULL,
    "periodo" TEXT NOT NULL,
    "unidadesVendidas" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VentaReceta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VentaReceta_ownerId_periodo_idx" ON "VentaReceta"("ownerId", "periodo");

-- CreateIndex
CREATE UNIQUE INDEX "VentaReceta_ownerId_recetaId_periodo_key" ON "VentaReceta"("ownerId", "recetaId", "periodo");

-- AddForeignKey
ALTER TABLE "VentaReceta" ADD CONSTRAINT "VentaReceta_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VentaReceta" ADD CONSTRAINT "VentaReceta_recetaId_fkey" FOREIGN KEY ("recetaId") REFERENCES "Receta"("id") ON DELETE CASCADE ON UPDATE CASCADE;
