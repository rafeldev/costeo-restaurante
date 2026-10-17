import type { Prisma } from "@prisma/client";
import { InventoryCountOpenError } from "@/lib/errors";

export async function lockInventoryOwner(
  tx: Prisma.TransactionClient,
  ownerId: string,
) {
  await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${ownerId} FOR UPDATE`;
}

export async function assertInventoryMovementAllowed(
  tx: Prisma.TransactionClient,
  ownerId: string,
) {
  await lockInventoryOwner(tx, ownerId);
  const toma = await tx.tomaInventario.findFirst({
    where: { ownerId, estado: "EN_CURSO" },
    select: { id: true, periodo: true },
  });
  if (toma) {
    throw new InventoryCountOpenError(toma.id, toma.periodo);
  }
}
