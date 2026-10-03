import { createHash } from "node:crypto";
import { z } from "zod";
import { db, transaction } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { audit, type RequestMeta } from "@/lib/audit";
import { addHours, addMinutes } from "@/lib/dates";
import { slugify, token } from "@/lib/ids";
import { env } from "@/lib/env";
import { getSettings } from "@/lib/settings";
import { assertPasswordStrength, dummyHash, hashPassword, verifyPassword } from "@/lib/auth/password";
import { revokeUserSessions, startSession } from "@/lib/auth/session";
import { notifyAdmins, notifyUsers } from "./notifications";
import nodemailer from "nodemailer";

const phone = z.string().trim().regex(/^[+0-9 ()-]{8,20}$/, "Numéro de téléphone invalide").optional();

export const registerInput = z.discriminatedUnion("accountType", [
  z.object({
    accountType: z.literal("CLIENT"),
    email: z.string().trim().toLowerCase().email("Adresse e-mail invalide"),
    password: z.string(),
    firstName: z.string().trim().min(1).max(60),
    lastName: z.string().trim().min(1).max(60),
    phone,
    cityId: z.string().optional(),
  }),
  z.object({
    accountType: z.literal("LENDER"),
    email: z.string().trim().toLowerCase().email("Adresse e-mail invalide"),
    password: z.string(),
    firstName: z.string().trim().min(1).max(60),
    lastName: z.string().trim().min(1).max(60),
    phone,
    companyName: z.string().trim().min(2).max(120),
    rccm: z.string().trim().max(60).optional(),
    cityId: z.string().min(1),
    description: z.string().trim().max(1000).optional(),
  }),
]);
export type RegisterInput = z.infer<typeof registerInput>;

/** CLIENT et LOUEUR sont exclusifs : un compte n'a qu'un type. Un loueur démarre en attente de validation par l'administration. */
export async function register(input: RegisterInput, meta: RequestMeta) {
  assertPasswordStrength(input.password);
  const existing = await db.user.findUnique({ where: { email: input.email } });
  if (existing) throw new AppError("CONFLICT", "Un compte existe déjà avec cette adresse e-mail.");
  const passwordHash = await hashPassword(input.password);

  const user = await transaction(async (tx) => {
    const created = await tx.user.create({
      data: { email: input.email, passwordHash, firstName: input.firstName, lastName: input.lastName, phone: input.phone, accountType: input.accountType, cityId: input.cityId },
    });
    if (input.accountType === "LENDER") {
      const city = await tx.city.findUnique({ where: { id: input.cityId } });
      if (!city) throw new AppError("VALIDATION_ERROR", "Ville inconnue.");
      let slug = slugify(input.companyName) || "loueur";
      if (await tx.lender.findUnique({ where: { slug } })) slug = `${slug}-${token(3).toLowerCase().replace(/[^a-z0-9]/g, "x")}`;
      await tx.lender.create({ data: { ownerId: created.id, slug, companyName: input.companyName, rccm: input.rccm, description: input.description, phone: input.phone, email: input.email, cityId: input.cityId, status: "PENDING" } });
      await notifyAdmins(tx, { type: "lender.pending", title: "Nouveau loueur à valider", body: `${input.companyName} demande la validation de son compte.`, link: "/admin/loueurs" }, "ADMIN_LENDERS");
    }
    await audit(tx, { userId: created.id, action: "auth.register", entity: "User", entityId: created.id, newValue: { accountType: input.accountType }, meta });
    await notifyUsers(tx, [created.id], { type: "auth.welcome", title: "Bienvenue sur LOC'CONNECT", body: input.accountType === "LENDER" ? "Votre compte est en cours de validation par notre équipe." : "Votre compte est prêt. Trouvez le matériel dont vous avez besoin.", link: "/" });
    return created;
  });
  const session = await startSession(user.id, meta);
  return { user, session };
}

export const loginInput = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1) });

/** Connexion avec verrouillage progressif après trop d'échecs, et temps de réponse égalisé pour ne pas révéler l'existence d'un e-mail. */
export async function login(input: z.infer<typeof loginInput>, meta: RequestMeta) {
  const settings = await getSettings();
  const user = await db.user.findUnique({ where: { email: input.email } });
  const generic = new AppError("UNAUTHENTICATED", "E-mail ou mot de passe incorrect.");

  if (!user) {
    await verifyPassword(input.password, await dummyHash());
    throw generic;
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw new AppError("ACCOUNT_LOCKED", "Trop de tentatives. Réessayez dans quelques minutes.");
  }
  const ok = await verifyPassword(input.password, user.passwordHash);
  if (!ok) {
    const failed = user.failedLoginCount + 1;
    const lock = failed >= settings["security.max_failed_logins"];
    await db.user.update({ where: { id: user.id }, data: { failedLoginCount: lock ? 0 : failed, lockedUntil: lock ? addMinutes(new Date(), settings["security.lockout_minutes"]) : null } });
    await audit(db, { userId: user.id, action: lock ? "auth.locked" : "auth.login_failed", entity: "User", entityId: user.id, meta });
    throw generic;
  }
  if (user.status !== "ACTIVE" || user.anonymizedAt) throw new AppError("ACCOUNT_SUSPENDED", "Ce compte est suspendu ou désactivé. Contactez le support.");

  await db.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() } });
  await audit(db, { userId: user.id, action: "auth.login", entity: "User", entityId: user.id, meta });
  const session = await startSession(user.id, meta);
  return { user, session };
}

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

/** Envoie le lien de réinitialisation. Sans SMTP (développement), le lien est renvoyé pour faciliter la démonstration. */
export async function forgotPassword(email: string, meta: RequestMeta): Promise<{ devLink?: string }> {
  const user = await db.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user || user.status !== "ACTIVE") return {};
  const raw = token(32);
  await db.passwordResetToken.create({ data: { userId: user.id, tokenHash: sha(raw), expiresAt: addHours(new Date(), 1) } });
  const link = `${env().APP_URL}/mot-de-passe-oublie?token=${raw}`;
  await audit(db, { userId: user.id, action: "auth.forgot_password", entity: "User", entityId: user.id, meta });
  if (env().SMTP_HOST) {
    const transport = nodemailer.createTransport({ host: env().SMTP_HOST, port: env().SMTP_PORT, secure: env().SMTP_PORT === 465, auth: env().SMTP_USER ? { user: env().SMTP_USER, pass: env().SMTP_PASSWORD } : undefined });
    await transport.sendMail({ from: env().MAIL_FROM, to: user.email, subject: "Réinitialisation de votre mot de passe LOC'CONNECT", text: `Pour choisir un nouveau mot de passe, ouvrez ce lien (valable 1 heure) :\n${link}` });
    return {};
  }
  console.info(`[LOC'CONNECT] Lien de réinitialisation pour ${user.email}: ${link}`);
  return process.env.NODE_ENV === "production" ? {} : { devLink: link };
}

export async function resetPassword(rawToken: string, password: string, meta: RequestMeta) {
  assertPasswordStrength(password);
  const row = await db.passwordResetToken.findUnique({ where: { tokenHash: sha(rawToken) } });
  if (!row || row.usedAt || row.expiresAt < new Date()) throw new AppError("VALIDATION_ERROR", "Ce lien est invalide ou a expiré.");
  const passwordHash = await hashPassword(password);
  await transaction(async (tx) => {
    await tx.user.update({ where: { id: row.userId }, data: { passwordHash, failedLoginCount: 0, lockedUntil: null } });
    await tx.passwordResetToken.update({ where: { id: row.id }, data: { usedAt: new Date() } });
    await revokeUserSessions(tx, row.userId);
    await audit(tx, { userId: row.userId, action: "auth.reset_password", entity: "User", entityId: row.userId, meta });
  });
}

export async function changePassword(userId: string, current: string, next: string, meta: RequestMeta) {
  assertPasswordStrength(next);
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (!(await verifyPassword(current, user.passwordHash))) throw new AppError("VALIDATION_ERROR", "Le mot de passe actuel est incorrect.");
  await transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(next) } });
    await revokeUserSessions(tx, userId);
    await audit(tx, { userId, action: "auth.change_password", entity: "User", entityId: userId, meta });
  });
}

export const profileInput = z.object({
  firstName: z.string().trim().min(1).max(60).optional(),
  lastName: z.string().trim().min(1).max(60).optional(),
  phone,
  deliveryAddress: z.string().trim().max(300).optional(),
  cityId: z.string().optional(),
});

export async function updateProfile(userId: string, input: z.infer<typeof profileInput>, meta: RequestMeta) {
  const before = await db.user.findUniqueOrThrow({ where: { id: userId } });
  const user = await db.user.update({ where: { id: userId }, data: input });
  await audit(db, { userId, action: "user.update_profile", entity: "User", entityId: userId, oldValue: { phone: before.phone, cityId: before.cityId }, newValue: input, meta });
  return user;
}

/**
 * Suppression de compte : désactivation et anonymisation des données personnelles.
 * Les éléments financiers, factures, audits et historiques sont conservés.
 */
export async function deleteAccount(userId: string, password: string, meta: RequestMeta) {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (!(await verifyPassword(password, user.passwordHash))) throw new AppError("VALIDATION_ERROR", "Mot de passe incorrect.");
  const active = await db.reservationItem.count({ where: { reservation: { clientId: userId }, status: { in: ["PAID", "CONFIRMED", "READY", "DELIVERING", "DELIVERED", "IN_USE", "RETURN_PENDING", "RETURNED", "DISPUTED"] } } });
  if (active > 0) throw new AppError("CONFLICT", "Vous avez des locations en cours : terminez-les avant de supprimer votre compte.");
  await transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { status: "DEACTIVATED", anonymizedAt: new Date(), email: `supprime-${userId}@anonyme.invalid`, firstName: "Compte", lastName: "supprimé", phone: null, deliveryAddress: null, avatarUrl: null } });
    await revokeUserSessions(tx, userId);
    await tx.cartItem.deleteMany({ where: { cart: { userId } } });
    await audit(tx, { userId, action: "user.anonymize", entity: "User", entityId: userId, meta });
  });
}
