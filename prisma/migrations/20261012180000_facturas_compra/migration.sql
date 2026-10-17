CREATE TYPE "TipoDocumentoCompra" AS ENUM ('FAC', 'REM');
CREATE TYPE "EstadoFactura" AS ENUM ('BORRADOR', 'APLICADA');
CREATE TYPE "CondicionPago" AS ENUM ('CONTADO', 'CREDITO_15', 'CREDITO_30');

CREATE TABLE "FacturaCompra" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "proveedorId" TEXT NOT NULL,
  "tipo" "TipoDocumentoCompra" NOT NULL,
  "numero" TEXT NOT NULL,
  "fechaEmision" TIMESTAMP(3) NOT NULL,
  "condicionPago" "CondicionPago" NOT NULL,
  "fechaVencimiento" TIMESTAMP(3),
  "estado" "EstadoFactura" NOT NULL DEFAULT 'BORRADOR',
  "actualizaCostos" BOOLEAN NOT NULL DEFAULT true,
  "subtotal" DECIMAL(14,4) NOT NULL,
  "impuestos" DECIMAL(14,4) NOT NULL,
  "total" DECIMAL(14,4) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FacturaCompra_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FacturaCompraLinea" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "facturaId" TEXT NOT NULL,
  "insumoId" TEXT NOT NULL,
  "cantidad" DECIMAL(14,4) NOT NULL,
  "unidad" "UnidadBase" NOT NULL,
  "precioUnitarioBruto" DECIMAL(14,4) NOT NULL,
  "tasaImpuestoPct" DECIMAL(5,2) NOT NULL,
  "totalLinea" DECIMAL(14,4) NOT NULL,
  "compraInsumoId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FacturaCompraLinea_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FacturaCompra_ownerId_tipo_numero_key" ON "FacturaCompra"("ownerId", "tipo", "numero");
CREATE INDEX "FacturaCompra_ownerId_fechaEmision_idx" ON "FacturaCompra"("ownerId", "fechaEmision");
CREATE INDEX "FacturaCompra_proveedorId_idx" ON "FacturaCompra"("proveedorId");
CREATE UNIQUE INDEX "FacturaCompraLinea_compraInsumoId_key" ON "FacturaCompraLinea"("compraInsumoId");
CREATE INDEX "FacturaCompraLinea_ownerId_insumoId_idx" ON "FacturaCompraLinea"("ownerId", "insumoId");
CREATE INDEX "FacturaCompraLinea_facturaId_idx" ON "FacturaCompraLinea"("facturaId");

ALTER TABLE "FacturaCompra" ADD CONSTRAINT "FacturaCompra_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FacturaCompra" ADD CONSTRAINT "FacturaCompra_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "Proveedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FacturaCompraLinea" ADD CONSTRAINT "FacturaCompraLinea_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FacturaCompraLinea" ADD CONSTRAINT "FacturaCompraLinea_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "FacturaCompra"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FacturaCompraLinea" ADD CONSTRAINT "FacturaCompraLinea_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "Insumo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FacturaCompraLinea" ADD CONSTRAINT "FacturaCompraLinea_compraInsumoId_fkey" FOREIGN KEY ("compraInsumoId") REFERENCES "CompraInsumo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
