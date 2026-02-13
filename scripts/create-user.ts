import "dotenv/config";
import bcrypt from "bcryptjs";
import { db } from "../lib/db";

function getArg(name: string) {
  const prefix = `--${name}=`;
  const arg = process.argv.find((value) => value.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : null;
}

async function main() {
  const email = getArg("email")?.trim().toLowerCase();
  const password = getArg("password")?.trim();

  if (!email || !password) {
    throw new Error("Uso: npm run user:create -- --email=usuario@dominio.com --password=secreto123");
  }
  if (password.length < 6) {
    throw new Error("La contraseña debe tener al menos 6 caracteres.");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await db.user.upsert({
    where: { email },
    update: { passwordHash },
    create: { email, passwordHash },
  });

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
