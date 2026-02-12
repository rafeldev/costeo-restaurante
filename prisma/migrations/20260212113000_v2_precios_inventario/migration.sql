-- CreateEnum
CREATE TYPE "TipoMovimientoInventario" AS ENUM ('ENTRADA', 'SALIDA', 'AJUSTE');

-- CreateTable
CREATE TABLE "Proveedor" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "contacto" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Proveedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompraInsumo" (
    "id" TEXT NOT NULL,
    "insumoId" TEXT NOT NULL,
    "proveedorId" TEXT,
    "fechaCompra" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cantidadCompra" DECIMAL(12,4) NOT NULL,
    "unidadCompra" "UnidadBase" NOT NULL,
    "precioTotal" DECIMAL(12,2) NOT NULL,
    "costoUnitarioCalculado" DECIMAL(12,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompraInsumo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventarioInsumo" (
    "insumoId" TEXT NOT NULL,
    "stockActual" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "stockMinimo" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventarioInsumo_pkey" PRIMARY KEY ("insumoId")
);

-- CreateTable
CREATE TABLE "MovimientoInventario" (
    "id" TEXT NOT NULL,
    "insumoId" TEXT NOT NULL,
    "tipo" "TipoMovimientoInventario" NOT NULL,
    "cantidad" DECIMAL(12,4) NOT NULL,
    "motivo" TEXT,
    "fechaMovimiento" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "referenciaCompraId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MovimientoInventario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Proveedor_nombre_key" ON "Proveedor"("nombre");

-- CreateIndex
CREATE INDEX "CompraInsumo_insumoId_fechaCompra_idx" ON "CompraInsumo"("insumoId", "fechaCompra");

-- CreateIndex
CREATE INDEX "CompraInsumo_proveedorId_fechaCompra_idx" ON "CompraInsumo"("proveedorId", "fechaCompra");

-- CreateIndex
CREATE INDEX "MovimientoInventario_insumoId_fechaMovimiento_idx" ON "MovimientoInventario"("insumoId", "fechaMovimiento");

-- CreateIndex
CREATE INDEX "MovimientoInventario_tipo_fechaMovimiento_idx" ON "MovimientoInventario"("tipo", "fechaMovimiento");

-- AddForeignKey
ALTER TABLE "CompraInsumo" ADD CONSTRAINT "CompraInsumo_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "Insumo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompraInsumo" ADD CONSTRAINT "CompraInsumo_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "Proveedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventarioInsumo" ADD CONSTRAINT "InventarioInsumo_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "Insumo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoInventario" ADD CONSTRAINT "MovimientoInventario_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "Insumo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoInventario" ADD CONSTRAINT "MovimientoInventario_referenciaCompraId_fkey" FOREIGN KEY ("referenciaCompraId") REFERENCES "CompraInsumo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
