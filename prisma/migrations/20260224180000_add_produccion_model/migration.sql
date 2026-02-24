-- CreateEnum
CREATE TYPE "EstadoProduccion" AS ENUM ('ACTIVA', 'ANULADA');

-- CreateTable
CREATE TABLE "Produccion" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "recetaId" TEXT,
    "recetaNombre" TEXT NOT NULL,
    "unidades" INTEGER NOT NULL,
    "costoTotalProduccion" DECIMAL(12,2) NOT NULL,
    "estado" "EstadoProduccion" NOT NULL DEFAULT 'ACTIVA',
    "fechaProduccion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Produccion_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "MovimientoInventario" ADD COLUMN "produccionId" TEXT;

-- CreateIndex
CREATE INDEX "Produccion_ownerId_fechaProduccion_idx" ON "Produccion"("ownerId", "fechaProduccion");

-- CreateIndex
CREATE INDEX "Produccion_recetaId_fechaProduccion_idx" ON "Produccion"("recetaId", "fechaProduccion");

-- CreateIndex
CREATE INDEX "MovimientoInventario_produccionId_idx" ON "MovimientoInventario"("produccionId");

-- AddForeignKey
ALTER TABLE "Produccion" ADD CONSTRAINT "Produccion_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Produccion" ADD CONSTRAINT "Produccion_recetaId_fkey" FOREIGN KEY ("recetaId") REFERENCES "Receta"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoInventario" ADD CONSTRAINT "MovimientoInventario_produccionId_fkey" FOREIGN KEY ("produccionId") REFERENCES "Produccion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
