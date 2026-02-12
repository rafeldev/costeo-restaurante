-- CreateEnum
CREATE TYPE "UnidadBase" AS ENUM ('GRAMO', 'KILOGRAMO', 'MILILITRO', 'LITRO', 'UNIDAD');

-- CreateTable
CREATE TABLE "Insumo" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "unidadBase" "UnidadBase" NOT NULL,
    "costoUnidad" DECIMAL(12,4) NOT NULL,
    "mermaPct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "proveedor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Insumo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Receta" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipoProducto" TEXT NOT NULL,
    "rendimientoPorciones" INTEGER NOT NULL,
    "tiempoPreparacionMin" INTEGER,
    "precioVentaActual" DECIMAL(12,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Receta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecetaInsumo" (
    "id" TEXT NOT NULL,
    "recetaId" TEXT NOT NULL,
    "insumoId" TEXT NOT NULL,
    "cantidad" DECIMAL(12,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecetaInsumo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfiguracionCosteo" (
    "id" TEXT NOT NULL,
    "overheadPct" DECIMAL(5,2) NOT NULL DEFAULT 10,
    "margenObjetivoPct" DECIMAL(5,2) NOT NULL DEFAULT 35,
    "impuestoPct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "redondeoPrecio" DECIMAL(8,2) NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConfiguracionCosteo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Insumo_nombre_key" ON "Insumo"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "RecetaInsumo_recetaId_insumoId_key" ON "RecetaInsumo"("recetaId", "insumoId");

-- AddForeignKey
ALTER TABLE "RecetaInsumo" ADD CONSTRAINT "RecetaInsumo_recetaId_fkey" FOREIGN KEY ("recetaId") REFERENCES "Receta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecetaInsumo" ADD CONSTRAINT "RecetaInsumo_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "Insumo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
