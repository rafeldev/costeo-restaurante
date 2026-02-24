-- CreateEnum
CREATE TYPE "EstadoVenta" AS ENUM ('ABIERTA', 'CERRADA', 'CANCELADA');

-- CreateTable
CREATE TABLE "Venta" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "estado" "EstadoVenta" NOT NULL DEFAULT 'ABIERTA',
    "fechaHora" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mesa" TEXT,
    "notas" TEXT,
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Venta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VentaItem" (
    "id" TEXT NOT NULL,
    "ventaId" TEXT NOT NULL,
    "recetaId" TEXT NOT NULL,
    "cantidad" DECIMAL(12,4) NOT NULL,
    "precioUnitario" DECIMAL(12,2) NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VentaItem_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "MovimientoInventario" ADD COLUMN "referenciaVentaId" TEXT;

-- CreateIndex
CREATE INDEX "Venta_ownerId_estado_idx" ON "Venta"("ownerId", "estado");
CREATE INDEX "Venta_ownerId_idx" ON "Venta"("ownerId");

-- CreateIndex
CREATE INDEX "VentaItem_ventaId_idx" ON "VentaItem"("ventaId");

-- CreateIndex
CREATE INDEX "MovimientoInventario_referenciaVentaId_idx" ON "MovimientoInventario"("referenciaVentaId");

-- AddForeignKey
ALTER TABLE "Venta" ADD CONSTRAINT "Venta_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VentaItem" ADD CONSTRAINT "VentaItem_ventaId_fkey" FOREIGN KEY ("ventaId") REFERENCES "Venta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VentaItem" ADD CONSTRAINT "VentaItem_recetaId_fkey" FOREIGN KEY ("recetaId") REFERENCES "Receta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoInventario" ADD CONSTRAINT "MovimientoInventario_referenciaVentaId_fkey" FOREIGN KEY ("referenciaVentaId") REFERENCES "Venta"("id") ON DELETE SET NULL ON UPDATE CASCADE;
