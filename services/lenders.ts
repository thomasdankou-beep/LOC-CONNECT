import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db, transaction } from "@/lib/db";
import { AppError, forbidden, notFound } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { parseDate } from "@/lib/dates";
import { token } from "@/lib/ids";
import { can, type Actor } from "@/lib/auth/actor";
import { hashPassword } from "@/lib/auth/password";
import { revokeUserSessions } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { notifyAdmins, notifyLender } from "./notifications";

type LenderActor = Actor & { lenderId: string };

const requireTeam = (actor: LenderActor) => {
  if (!can(actor, "TEAM_MANAGE")) throw forbidden("Seul le propriétaire peut gérer les sous-comptes.");
};

const LENDER_PERMISSION_CODES = new Set(PERMISSIONS.filter((p) => p.scope === "LENDER").map((p) => p.code));
/** Les droits de gestion d'équipe et d'audit restent réservés au propriétaire. */
const OWNER_ONLY = new Set(["TEAM_MANAGE", "AUDIT_VIEW"]);

export async function listPermissions() {
  return db.permission.findMany({ where: { scope: "LENDER" }, orderBy: [{ domain: "asc" }, { code: "asc" }] });
}

export async function listRoles(lenderId: string) {
  return db.role.findMany({
    where: { scope: "LENDER", OR: [{ isSystem: true }, { lenderId }] },
    include: { permissions: { include: { permission: { select: { code: true, label: true, domain: true } } } }, _count: { select: { members: true } } },
    orderBy: [{ isSystem: "desc" }, { name: "asc" }],
  });
}

export const roleInput = z.object({ name: z.string().trim().min(3).max(60), description: z.string().trim().max(200).optional(), permissions: z.array(z.string()).min(1) });

function checkPermissionCodes(codes: string[]) {
  for (const c of codes) {
    if (!LENDER_PERMISSION_CODES.has(c)) throw new AppError("VALIDATION_ERROR", `Permission inconnue : ${c}`);
    if (OWNER_ONLY.has(c)) throw new AppError("VALIDATION_ERROR", `La permission ${c} est réservée au propriétaire.`);
  }
}

export async function createRole(actor: LenderActor, input: z.infer<typeof roleInput>) {
  requireTeam(actor);
  checkPermissionCodes(input.permissions);
  const code = input.name.toUpperCase().normalize("NFD").replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "");
  const key = `${actor.lenderId}:${code}`;
  if (await db.role.findUnique({ where: { key } })) throw new AppError("CONFLICT", "Un rôle de ce nom existe déjà.");
  const perms = await db.permission.findMany({ where: { code: { in: input.permissions } } });
  return transaction(async (tx) => {
    const role = await tx.role.create({ data: { key, code, name: input.name, description: input.description, scope: "LENDER", lenderId: actor.lenderId, permissions: { create: perms.map((p) => ({ permissionId: p.id })) } } });
    await audit(tx, { userId: actor.userId, lenderId: actor.lenderId, action: "role.create", entity: "Role", entityId: role.id, newValue: { name: input.name, permissions: input.permissions }, meta: actor.meta });
    return role;
  });
}

export async function updateRole(actor: LenderActor, roleId: string, input: Partial<z.infer<typeof roleInput>>) {
  requireTeam(actor);
  const role = await db.role.findFirst({ where: { id: roleId, lenderId: actor.lenderId, isSystem: false }, include: { permissions: { include: { permission: true } } } });
  if (!role) throw notFound("Rôle");
  if (input.permissions) checkPermissionCodes(input.permissions);
  return transaction(async (tx) => {
    if (input.permissions) {
      const perms = await tx.permission.findMany({ where: { code: { in: input.permissions } } });
      await tx.rolePermission.deleteMany({ where: { roleId } });
      await tx.rolePermission.createMany({ data: perms.map((p) => ({ roleId, permissionId: p.id })) });
      // La modification de droits prend effet immédiatement : les sessions des membres concernés sont conservées, les droits sont relus à chaque requête.
    }
    const updated = await tx.role.update({ where: { id: roleId }, data: { name: input.name ?? role.name, description: input.description ?? role.description } });
    await audit(tx, { userId: actor.userId, lenderId: actor.lenderId, action: "role.update", entity: "Role", entityId: roleId, oldValue: { permissions: role.permissions.map((p) => p.permission.code) }, newValue: input, meta: actor.meta });
    return updated;
  });
}

export async function listMembers(lenderId: string) {
  return db.lenderMember.findMany({ where: { lenderId }, include: { user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, lastLoginAt: true, status: true } }, role: { select: { id: true, name: true, code: true } } }, orderBy: { createdAt: "asc" } });
}

export const memberInput = z.object({
  email: z.string().trim().toLowerCase().email(),
  firstName: z.string().trim().min(1).max(60),
  lastName: z.string().trim().min(1).max(60),
  phone: z.string().trim().max(30).optional(),
  roleId: z.string().min(1),
});

async function assertRoleUsable(lenderId: string, roleId: string) {
  const role = await db.role.findFirst({ where: { id: roleId, scope: "LENDER", OR: [{ isSystem: true }, { lenderId }] } });
  if (!role) throw new AppError("VALIDATION_ERROR", "Rôle inconnu pour cette entreprise.");
  return role;
}

/** Crée un sous-compte rattaché exclusivement à cette entreprise. Un mot de passe provisoire est généré et affiché une seule fois. */
export async function createMember(actor: LenderActor, input: z.infer<typeof memberInput>) {
  requireTeam(actor);
  await assertRoleUsable(actor.lenderId, input.roleId);
  if (await db.user.findUnique({ where: { email: input.email } })) throw new AppError("CONFLICT", "Un compte existe déjà avec cette adresse e-mail.");
  const temporaryPassword = `${token(6).replace(/[-_]/g, "x")}A1!`;
  const passwordHash = await hashPassword(temporaryPassword);
  const member = await transaction(async (tx) => {
    const user = await tx.user.create({ data: { email: input.email, passwordHash, firstName: input.firstName, lastName: input.lastName, phone: input.phone, accountType: "LENDER" } });
    const m = await tx.lenderMember.create({ data: { lenderId: actor.lenderId, userId: user.id, roleId: input.roleId, createdById: actor.userId } });
    await audit(tx, { userId: actor.userId, lenderId: actor.lenderId, action: "member.create", entity: "LenderMember", entityId: m.id, newValue: { email: input.email, roleId: input.roleId }, meta: actor.meta });
    return m;
  });
  return { member, temporaryPassword };
}

export const memberPatch = z.object({ roleId: z.string().optional(), firstName: z.string().trim().min(1).max(60).optional(), lastName: z.string().trim().min(1).max(60).optional(), phone: z.string().trim().max(30).optional(), status: z.enum(["ACTIVE", "SUSPENDED"]).optional() });

export async function updateMember(actor: LenderActor, memberId: string, patch: z.infer<typeof memberPatch>) {
  requireTeam(actor);
  const member = await db.lenderMember.findFirst({ where: { id: memberId, lenderId: actor.lenderId } });
  if (!member) throw notFound("Sous-compte");
  if (patch.roleId) await assertRoleUsable(actor.lenderId, patch.roleId);
  return transaction(async (tx) => {
    const { firstName, lastName, phone, ...own } = patch;
    if (firstName || lastName || phone !== undefined) await tx.user.update({ where: { id: member.userId }, data: { firstName, lastName, phone } });
    const updated = await tx.lenderMember.update({ where: { id: memberId }, data: own });
    if (patch.status === "SUSPENDED") await revokeUserSessions(tx, member.userId);
    await audit(tx, { userId: actor.userId, lenderId: actor.lenderId, action: "member.update", entity: "LenderMember", entityId: memberId, oldValue: { roleId: member.roleId, status: member.status }, newValue: patch, meta: actor.meta });
    return updated;
  });
}

/** Désactivation : révoque immédiatement les sessions, sans supprimer l'historique de ses actions. */
export async function disableMember(actor: LenderActor, memberId: string) {
  requireTeam(actor);
  const member = await db.lenderMember.findFirst({ where: { id: memberId, lenderId: actor.lenderId } });
  if (!member) throw notFound("Sous-compte");
  return transaction(async (tx) => {
    const updated = await tx.lenderMember.update({ where: { id: memberId }, data: { status: "DEACTIVATED", deactivatedAt: new Date() } });
    await tx.user.update({ where: { id: member.userId }, data: { status: "DEACTIVATED" } });
    await revokeUserSessions(tx, member.userId);
    await audit(tx, { userId: actor.userId, lenderId: actor.lenderId, action: "member.disable", entity: "LenderMember", entityId: memberId, meta: actor.meta });
    return updated;
  });
}

export async function assignRole(actor: LenderActor, memberId: string, roleId: string) {
  return updateMember(actor, memberId, { roleId });
}

export const auditQuery = z.object({ userId: z.string().optional(), action: z.string().optional(), entity: z.string().optional(), from: z.string().optional(), to: z.string().optional(), page: z.coerce.number().int().min(1).default(1) });

export async function listLenderAudit(actor: LenderActor, q: z.infer<typeof auditQuery>) {
  if (!can(actor, "AUDIT_VIEW")) throw forbidden();
  const where: Prisma.AuditLogWhereInput = {
    lenderId: actor.lenderId,
    ...(q.userId ? { userId: q.userId } : {}),
    ...(q.action ? { action: { contains: q.action, mode: "insensitive" } } : {}),
    ...(q.entity ? { entity: q.entity } : {}),
    ...(q.from || q.to ? { createdAt: { ...(q.from ? { gte: parseDate(q.from) } : {}), ...(q.to ? { lt: new Date(parseDate(q.to).getTime() + 86_400_000) } : {}) } } : {}),
  };
  const pageSize = 30;
  const [total, rows] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.findMany({ where, include: { user: { select: { firstName: true, lastName: true } } }, orderBy: { createdAt: "desc" }, skip: (q.page - 1) * pageSize, take: pageSize }),
  ]);
  return { rows, total, page: q.page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

export const companyInput = z.object({
  companyName: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().max(1500).optional(),
  phone: z.string().trim().max(30).optional(),
  email: z.string().trim().email().optional(),
  address: z.string().trim().max(300).optional(),
  logoUrl: z.string().max(500).optional(),
  coverUrl: z.string().max(500).optional(),
  offersDelivery: z.boolean().optional(),
  deliveryFeeLocal: z.number().int().min(0).max(1_000_000).optional(),
  deliveryFeeRemote: z.number().int().min(0).max(1_000_000).optional(),
});

export async function updateCompany(actor: LenderActor, input: z.infer<typeof companyInput>) {
  if (!can(actor, "COMPANY_MANAGE")) throw forbidden();
  const before = await db.lender.findUniqueOrThrow({ where: { id: actor.lenderId } });
  const updated = await db.lender.update({ where: { id: actor.lenderId }, data: input });
  await audit(db, { userId: actor.userId, lenderId: actor.lenderId, action: "company.update", entity: "Lender", entityId: actor.lenderId, oldValue: { fees: [before.deliveryFeeLocal, before.deliveryFeeRemote], offersDelivery: before.offersDelivery }, newValue: input, meta: actor.meta });
  return updated;
}

export const paymentModeInput = z.object({ paymentMode: z.enum(["ONLINE_FULL", "DEPOSIT_CASH"]) });

/**
 * Le loueur choisit d'être payé entièrement en ligne ou par acompte en ligne et solde en espèces.
 * Le mode espèces doit avoir été ouvert par l'administration. Les réservations existantes gardent leur mode.
 */
export async function setPaymentMode(actor: LenderActor, input: z.infer<typeof paymentModeInput>) {
  if (!actor.isLenderOwner && !can(actor, "COMPANY_MANAGE")) throw forbidden();
  const before = await db.lender.findUniqueOrThrow({ where: { id: actor.lenderId } });
  if (input.paymentMode === "DEPOSIT_CASH" && !before.cashModeAllowed) throw forbidden("Le paiement en espèces doit d'abord être ouvert pour votre entreprise par LOC'CONNECT.");
  const updated = await db.lender.update({ where: { id: actor.lenderId }, data: { paymentMode: input.paymentMode } });
  await audit(db, { userId: actor.userId, lenderId: actor.lenderId, action: "company.payment_mode", entity: "Lender", entityId: actor.lenderId, oldValue: { paymentMode: before.paymentMode }, newValue: input, meta: actor.meta });
  return updated;
}

export const payoutDetailsInput = z.object({ method: z.enum(["BANK_TRANSFER", "ORANGE_MONEY", "MTN_MONEY", "MOOV_MONEY", "WAVE"]), account: z.string().trim().min(6).max(60) });

/** Toute modification des coordonnées de versement exige une validation renforcée par l'administration. */
export async function requestPayoutDetailsChange(actor: LenderActor, input: z.infer<typeof payoutDetailsInput>) {
  if (!actor.isLenderOwner && !can(actor, "COMPANY_MANAGE")) throw forbidden();
  const pending = await db.validationAction.count({ where: { type: "PAYOUT_DETAILS", entityId: actor.lenderId, status: "PENDING" } });
  if (pending > 0) throw new AppError("CONFLICT", "Une demande de modification est déjà en attente de validation.");
  return transaction(async (tx) => {
    const v = await tx.validationAction.create({ data: { type: "PAYOUT_DETAILS", entity: "Lender", entityId: actor.lenderId, lenderId: actor.lenderId, requestedById: actor.userId, payload: input } });
    await audit(tx, { userId: actor.userId, lenderId: actor.lenderId, action: "payout_details.request", entity: "Lender", entityId: actor.lenderId, newValue: { method: input.method }, meta: actor.meta });
    await notifyAdmins(tx, { type: "validation.pending", title: "Coordonnées de versement à valider", body: "Un loueur demande à modifier ses coordonnées de versement.", link: "/admin/loueurs" }, "ADMIN_PAYOUTS");
    return v;
  });
}

export async function decideValidation(actor: Actor, id: string, approve: boolean, reason?: string) {
  if (actor.accountType !== "ADMIN" || !can(actor, "ADMIN_PAYOUTS")) throw forbidden();
  const v = await db.validationAction.findUnique({ where: { id } });
  if (!v) throw notFound("Validation");
  if (v.status !== "PENDING") throw new AppError("CONFLICT", "Cette demande a déjà été traitée.");
  if (v.requestedById === actor.userId) throw new AppError("FORBIDDEN", "Vous ne pouvez pas valider votre propre demande.");
  return transaction(async (tx) => {
    if (approve && v.type === "PAYOUT_DETAILS") {
      const p = v.payload as { method: string; account: string };
      await tx.lender.update({ where: { id: v.entityId }, data: { payoutMethod: p.method, payoutAccount: p.account } });
    }
    const updated = await tx.validationAction.update({ where: { id }, data: { status: approve ? "APPROVED" : "REJECTED", validatedById: actor.userId, validatedAt: new Date(), reason } });
    await audit(tx, { userId: actor.userId, lenderId: v.lenderId, action: `validation.${approve ? "approve" : "reject"}`, entity: "ValidationAction", entityId: id, newValue: { type: v.type, reason }, meta: actor.meta });
    if (v.lenderId) await notifyLender(tx, v.lenderId, { type: "validation.decided", title: approve ? "Coordonnées de versement validées" : "Coordonnées de versement refusées", body: reason ?? "", link: "/loueur/entreprise" });
    return updated;
  });
}

export const unavailabilityInput = z.object({ startDate: z.string(), endDate: z.string(), reason: z.string().trim().max(200).optional() });

/** Indisponibilité du loueur : bloque les nouvelles réservations sur la période, sans toucher aux réservations existantes. */
export async function createUnavailability(actor: LenderActor, input: z.infer<typeof unavailabilityInput>) {
  if (!can(actor, "CALENDAR_MANAGE")) throw forbidden();
  const start = parseDate(input.startDate);
  const end = parseDate(input.endDate);
  if (!(start < end)) throw new AppError("VALIDATION_ERROR", "La date de début doit précéder la date de fin.");
  const row = await db.lenderUnavailability.create({ data: { lenderId: actor.lenderId, startDate: start, endDate: end, reason: input.reason } });
  await audit(db, { userId: actor.userId, lenderId: actor.lenderId, action: "unavailability.create", entity: "LenderUnavailability", entityId: row.id, newValue: input, meta: actor.meta });
  return row;
}

export async function deleteUnavailability(actor: LenderActor, id: string) {
  if (!can(actor, "CALENDAR_MANAGE")) throw forbidden();
  const row = await db.lenderUnavailability.findFirst({ where: { id, lenderId: actor.lenderId } });
  if (!row) throw notFound("Indisponibilité");
  await db.lenderUnavailability.update({ where: { id }, data: { active: false } });
  await audit(db, { userId: actor.userId, lenderId: actor.lenderId, action: "unavailability.delete", entity: "LenderUnavailability", entityId: id, meta: actor.meta });
}

export async function listUnavailabilities(lenderId: string) {
  return db.lenderUnavailability.findMany({ where: { lenderId, active: true, endDate: { gte: new Date() } }, orderBy: { startDate: "asc" } });
}

export async function lenderClients(lenderId: string) {
  const rows = await db.reservationItem.findMany({ where: { lenderId, status: { notIn: ["HOLD", "PENDING_PAYMENT", "DRAFT"] } }, select: { subtotal: true, createdAt: true, reservation: { select: { id: true, client: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } } } } } });
  const map = new Map<string, { id: string; name: string; phone: string | null; email: string; reservations: Set<string>; spent: number; last: Date }>();
  for (const r of rows) {
    const c = r.reservation.client;
    const e = map.get(c.id) ?? { id: c.id, name: `${c.firstName} ${c.lastName}`, phone: c.phone, email: c.email, reservations: new Set<string>(), spent: 0, last: r.createdAt };
    e.reservations.add(r.reservation.id);
    e.spent += r.subtotal;
    if (r.createdAt > e.last) e.last = r.createdAt;
    map.set(c.id, e);
  }
  return [...map.values()].map((e) => ({ ...e, reservations: e.reservations.size })).sort((a, b) => b.spent - a.spent);
}
