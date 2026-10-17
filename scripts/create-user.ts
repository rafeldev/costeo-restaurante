import "dotenv/config";
import bcrypt from "bcryptjs";
import { db } from "../lib/db";
import { bootstrapOwner } from "../lib/owner-bootstrap";

function getArg(name: string) {
  const prefix = `--${name}=`;
  const arg = process.argv.find((value) => value.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : null;
}

async function main() {
  const email = getArg("email")?.trim().toLowerCase();
  const password = getArg("password")?.trim();
  const restaurantName = getArg("restaurant")?.trim();

  if (!email || !password || !restaurantName) {
    throw new Error("Uso: npm run user:create -- --email=usuario@dominio.com --password=clave-segura --restaurant=Nombre");
  }
  if (password.length < 12 || password.length > 128) {
    throw new Error("La contraseña debe tener entre 12 y 128 caracteres.");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await bootstrapOwner({ email, passwordHash, restaurantName });

  console.info(`Usuario listo: ${user.email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
