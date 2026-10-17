import { db } from "@/lib/db";
import { CONFIGURACION_COSTEO_DEFAULTS } from "@/lib/configuracion-costeo";
import { ConflictError } from "@/lib/errors";

const DEFAULT_AREAS = ["Cámara Fría", "Bodega Seca", "Barra", "Cocina Caliente"];

export async function bootstrapOwner(input: {
  email: string;
  passwordHash: string;
  restaurantName: string;
}) {
  return db.$transaction(async (tx) => {
    const email = input.email.trim().toLowerCase();
    const existing = await tx.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) throw new ConflictError("Ya existe un usuario con ese correo");
    const owner = await tx.user.create({
      data: {
        email,
        passwordHash: input.passwordHash,
        restaurantName: input.restaurantName.trim(),
      },
    });
    await tx.configuracionCosteo.create({
      data: { ownerId: owner.id, ...CONFIGURACION_COSTEO_DEFAULTS },
    });
    await tx.areaAlmacen.createMany({
      data: DEFAULT_AREAS.map((nombre, index) => ({ ownerId: owner.id, nombre, orden: index + 1 })),
    });
    return owner;
  });
}
