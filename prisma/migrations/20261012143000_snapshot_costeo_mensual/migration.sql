-- CreateTable
CREATE TABLE "SnapshotCosteoMensual" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "periodo" TEXT NOT NULL,
    "foodCostPct" DECIMAL(5,2) NOT NULL,
    "margenPct" DECIMAL(5,2) NOT NULL,
    "recetasActivas" INTEGER NOT NULL,
    "recetasRiesgo" INTEGER NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SnapshotCosteoMensual_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SnapshotCosteoMensual_ownerId_periodo_key" ON "SnapshotCosteoMensual"("ownerId", "periodo");

-- CreateIndex
CREATE INDEX "SnapshotCosteoMensual_ownerId_creadoEn_idx" ON "SnapshotCosteoMensual"("ownerId", "creadoEn");

-- AddForeignKey
ALTER TABLE "SnapshotCosteoMensual" ADD CONSTRAINT "SnapshotCosteoMensual_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
