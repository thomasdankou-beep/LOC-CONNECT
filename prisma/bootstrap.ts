/**
 * Initialisation d'une base vide (production) : données système puis premier super administrateur.
 *   npx tsx prisma/bootstrap.ts --email admin@exemple.ci --password '********' [--first Prénom] [--last Nom]
 * Idempotent : ne touche pas aux paramètres déjà personnalisés, ne recrée pas un compte existant.
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { hashPassword, assertPasswordStrength } from "../lib/auth/password";
import { seedSystemData } from "./system";

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
};

async function main() {
  const email = arg("email")?.trim().toLowerCase();
  const password = arg("password");
  if (!email || !password) {
    console.error("Usage : npx tsx prisma/bootstrap.ts --email <adresse> --password <mot de passe> [--first <prénom>] [--last <nom>]");
    process.exit(1);
  }
  assertPasswordStrength(password);
  const db = new PrismaClient();
  try {
    await seedSystemData(db);
    console.log("Données système : permissions, rôles, paramètres et politique d'annulation en place.");
    if (await db.user.findUnique({ where: { email } })) {
      console.log(`Le compte ${email} existe déjà : aucune création.`);
      return;
    }
    const user = await db.user.create({ data: { email, passwordHash: await hashPassword(password), firstName: arg("first") ?? "Administrateur", lastName: arg("last") ?? "LOC'CONNECT", accountType: "ADMIN" } });
    const role = await db.role.findUniqueOrThrow({ where: { key: "SYSTEM:SUPER_ADMIN" } });
    await db.userRole.create({ data: { userId: user.id, roleId: role.id } });
    console.log(`Super administrateur créé : ${email}`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
