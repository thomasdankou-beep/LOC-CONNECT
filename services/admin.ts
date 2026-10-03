import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db, transaction } from "@/lib/db";
import { AppError, forbidden, notFound } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { addDays } from "@/lib/dates";
import { slugify } from "@/lib/ids";
import { can, type Actor } from "@/lib/auth/actor";
import { revokeUserSessions } from "@/lib/auth/session";
import { SETTING_DEFS, getSettings, invalidateSettings, validateSettingValue, type SettingKey } from "@/lib/settings";
import { notifyLender, notifyUsers } from "./notifications";
import { holdNonConversionRate } from "./holds";

const need = (actor: Actor, permission: string) => {
  if (actor.accountType !== "ADMIN" || !can(actor, permission)) throw forbidden();
};

type PageOpts = { page?: number; pageSize?: number };
const paging = (o: PageOpts, defSize = 20) => {
  const page = Math.max(1, o.page ?? 1);
  const pageSize = Math.min(100, o.pageSize ?? defSize);
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
};
const result = <T>(rows: T[], total: number, p: { page: number; pageSize: number }) => ({ rows, total, page: p.page, pageSize: p.pageSize, totalPages: Math.max(1, Math.ceil(total / p.pageSize)) });

// ---------------------------------------------------------------------------
// Tableau de bord
// ---------------------------------------------------------------------------

export async function dashboardStats(actor: Actor) {
  need(actor, "ADMIN_DASHBOARD");
  const now = new Date();
  const since30 = addDays(now, -30);
  const [users, activeUsers, lenders, pendingLenders, products, pendingProducts, byStatus, paid, refunded, commission, deposits, disputes, openDisputes, frozen, toRecover, holdTotal, holdExpired, monthly, payoutsPending] = await Promise.all([
    db.user.count({ where: { accountType: "CLIENT" } }),
    db.user.count({ where: { status: "ACTIVE", lastLoginAt: { gte: since30 } } }),
    db.lender.count({ where: { status: "APPROVED" } }),
    db.lender.count({ where: { status: "PENDING" } }),
    db.product.count({ where: { status: "PUBLISHED", deletedAt: null } }),
    db.product.count({ where: { status: "PENDING_REVIEW", deletedAt: null } }),
    db.reservation.groupBy({ by: ["status"], _count: true }),
    db.payment.aggregate({ where: { status: { in: ["PAID", "PARTIALLY_REFUNDED", "REFUNDED"] } }, _sum: { amount: true } }),
    db.refund.aggregate({ where: { status: "COMPLETED", kind: { not: "DEPOSIT_RELEASE" } }, _sum: { amount: true } }),
    db.paymentAllocation.aggregate({ _sum: { commissionAmount: true, netAmount: true } }),
    db.deposit.groupBy({ by: ["status"], _sum: { amount: true, withheldAmount: true, releasedAmount: true }, _count: true }),
    db.dispute.count(),
    db.dispute.count({ where: { status: { in: ["OPEN", "UNDER_REVIEW", "WAITING_RESPONSE"] } } }),
    db.balanceEntry.aggregate({ where: { payoutId: null, amount: { gt: 0 }, blocked: false, availableAt: { gt: now } }, _sum: { amount: true } }),
    db.lenderReimbursement.aggregate({ where: { status: "TO_RECOVER" }, _sum: { impactedAmount: true } }),
    db.hold.count({ where: { status: { in: ["CONVERTED", "EXPIRED"] } } }),
    db.hold.count({ where: { status: "EXPIRED" } }),
    db.$queryRaw<{ month: Date; revenue: bigint; commission: bigint }[]>`
      SELECT date_trunc('month', pa."createdAt") AS month, COALESCE(SUM(pa."rentalAmount" + pa."deliveryAmount"), 0)::bigint AS revenue, COALESCE(SUM(pa."commissionAmount"), 0)::bigint AS commission
      FROM "PaymentAllocation" pa WHERE pa."createdAt" >= (date_trunc('month', now()) - interval '5 months') GROUP BY 1 ORDER BY 1`,
    db.balanceEntry.aggregate({ where: { payoutId: null, amount: { gt: 0 }, blocked: false, availableAt: { lte: now } }, _sum: { amount: true } }),
  ]);
  const dep = (s: string) => deposits.find((d) => d.status === s);
  return {
    users,
    activeUsers,
    lenders,
    pendingLenders,
    products,
    pendingProducts,
    reservationsByStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count])) as Record<string, number>,
    grossRevenue: (paid._sum.amount ?? 0) - (refunded._sum.amount ?? 0),
    commissions: commission._sum.commissionAmount ?? 0,
    lenderNet: commission._sum.netAmount ?? 0,
    deposits: {
      held: dep("HELD")?._sum.amount ?? 0,
      released: deposits.reduce((s, d) => s + (d._sum.releasedAmount ?? 0), 0),
      withheld: deposits.reduce((s, d) => s + (d._sum.withheldAmount ?? 0), 0),
    },
    refunds: refunded._sum.amount ?? 0,
    disputes,
    openDisputes,
    frozenAmount: frozen._sum.amount ?? 0,
    payableAmount: payoutsPending._sum.amount ?? 0,
    toRecover: toRecover._sum.impactedAmount ?? 0,
    holdNonConversionRate: holdTotal ? holdExpired / holdTotal : 0,
    monthly: monthly.map((m) => ({ month: m.month.toISOString().slice(0, 7), revenue: Number(m.revenue), commission: Number(m.commission) })),
  };
}

// ---------------------------------------------------------------------------
// Listes
// ---------------------------------------------------------------------------

export async function listUsers(actor: Actor, o: PageOpts & { q?: string; type?: string; status?: string } = {}) {
  need(actor, "ADMIN_USERS");
  const p = paging(o);
  const where: Prisma.UserWhereInput = {
    ...(o.type ? { accountType: o.type as never } : {}),
    ...(o.status ? { status: o.status as never } : {}),
    ...(o.q ? { OR: [{ email: { contains: o.q, mode: "insensitive" } }, { lastName: { contains: o.q, mode: "insensitive" } }, { firstName: { contains: o.q, mode: "insensitive" } }] } : {}),
  };
  const [total, rows] = await Promise.all([db.user.count({ where }), db.user.findMany({ where, select: { id: true, email: true, firstName: true, lastName: true, accountType: true, status: true, createdAt: true, lastLoginAt: true, roles: { select: { role: { select: { name: true, code: true } } } }, ownedLender: { select: { companyName: true } }, lenderMembership: { select: { lender: { select: { companyName: true } } } } }, orderBy: { createdAt: "desc" }, skip: p.skip, take: p.take })]);
  return result(rows, total, p);
}

export async function listLenders(actor: Actor, o: PageOpts & { q?: string; status?: string } = {}) {
  need(actor, "ADMIN_LENDERS");
  const p = paging(o);
  const where: Prisma.LenderWhereInput = { ...(o.status ? { status: o.status as never } : {}), ...(o.q ? { companyName: { contains: o.q, mode: "insensitive" } } : {}) };
  const [total, rows] = await Promise.all([db.lender.count({ where }), db.lender.findMany({ where, include: { city: true, owner: { select: { email: true, firstName: true, lastName: true } }, _count: { select: { products: true, members: true } }, subscriptions: { where: { status: "ACTIVE" }, take: 1 } }, orderBy: [{ status: "asc" }, { createdAt: "desc" }], skip: p.skip, take: p.take })]);
  return result(rows, total, p);
}

export async function listProducts(actor: Actor, o: PageOpts & { q?: string; status?: string } = {}) {
  need(actor, "ADMIN_PRODUCTS");
  const p = paging(o);
  const where: Prisma.ProductWhereInput = { deletedAt: null, ...(o.status ? { status: o.status as never } : {}), ...(o.q ? { name: { contains: o.q, mode: "insensitive" } } : {}) };
  const [total, rows] = await Promise.all([db.product.count({ where }), db.product.findMany({ where, include: { lender: { select: { companyName: true } }, category: { select: { name: true } }, city: { select: { name: true } }, photos: { orderBy: { position: "asc" }, take: 1 } }, orderBy: [{ status: "asc" }, { createdAt: "desc" }], skip: p.skip, take: p.take })]);
  return result(rows, total, p);
}

export async function listReservations(actor: Actor, o: PageOpts & { q?: string; status?: string } = {}) {
  need(actor, "ADMIN_RESERVATIONS");
  const p = paging(o);
  const where: Prisma.ReservationWhereInput = { status: o.status ? (o.status as never) : { notIn: ["DRAFT"] }, ...(o.q ? { OR: [{ reference: { contains: o.q, mode: "insensitive" } }, { client: { lastName: { contains: o.q, mode: "insensitive" } } }] } : {}) };
  const [total, rows] = await Promise.all([db.reservation.count({ where }), db.reservation.findMany({ where, include: { client: { select: { firstName: true, lastName: true } }, items: { select: { lender: { select: { companyName: true } } } } }, orderBy: { createdAt: "desc" }, skip: p.skip, take: p.take })]);
  return result(rows, total, p);
}

export async function listPayments(actor: Actor, o: PageOpts & { status?: string } = {}) {
  need(actor, "ADMIN_PAYMENTS");
  const p = paging(o);
  const where: Prisma.PaymentWhereInput = o.status ? { status: o.status as never } : {};
  const [total, rows] = await Promise.all([db.payment.count({ where }), db.payment.findMany({ where, include: { reservation: { select: { reference: true, id: true } }, user: { select: { firstName: true, lastName: true } }, allocations: { select: { lenderId: true, netAmount: true, commissionAmount: true } } }, orderBy: { createdAt: "desc" }, skip: p.skip, take: p.take })]);
  return result(rows, total, p);
}

export async function listRefunds(actor: Actor, o: PageOpts = {}) {
  need(actor, "ADMIN_REFUNDS");
  const p = paging(o);
  const [total, rows] = await Promise.all([db.refund.count(), db.refund.findMany({ include: { reservation: { select: { reference: true, id: true } }, reimbursements: { select: { lenderId: true, impactedAmount: true, status: true } } }, orderBy: { createdAt: "desc" }, skip: p.skip, take: p.take })]);
  return result(rows, total, p);
}

/** Commissions par loueur : base de calcul, commission perçue, part nette du loueur. */
export async function commissionSummary(actor: Actor) {
  need(actor, "ADMIN_COMMISSIONS");
  const [rows, settings] = await Promise.all([
    db.paymentAllocation.groupBy({ by: ["lenderId"], _sum: { rentalAmount: true, deliveryAmount: true, commissionAmount: true, netAmount: true }, _count: true }),
    getSettings(),
  ]);
  const lenders = await db.lender.findMany({ where: { id: { in: rows.map((r) => r.lenderId) } }, select: { id: true, companyName: true, commissionRateBps: true } });
  return { defaultRateBps: settings["commission.rate_bps"], rows: rows.map((r) => ({ ...r, lender: lenders.find((l) => l.id === r.lenderId) })).sort((a, b) => (b._sum.commissionAmount ?? 0) - (a._sum.commissionAmount ?? 0)) };
}

export async function listDeposits(actor: Actor, o: PageOpts & { status?: string } = {}) {
  need(actor, "ADMIN_DEPOSITS");
  const p = paging(o);
  const where: Prisma.DepositWhereInput = o.status ? { status: o.status as never } : {};
  const [total, rows] = await Promise.all([db.deposit.count({ where }), db.deposit.findMany({ where, include: { item: { select: { productName: true, reservation: { select: { reference: true, id: true } }, lender: { select: { companyName: true } }, returnReport: { select: { status: true } } } } }, orderBy: { createdAt: "desc" }, skip: p.skip, take: p.take })]);
  return result(rows, total, p);
}

export async function listReturns(actor: Actor, o: PageOpts = {}) {
  need(actor, "ADMIN_RETURNS");
  const p = paging(o);
  const [total, rows] = await Promise.all([db.returnReport.count(), db.returnReport.findMany({ include: { item: { select: { productName: true, reservation: { select: { reference: true, id: true } }, lender: { select: { companyName: true } } } }, photos: { select: { id: true } } }, orderBy: { createdAt: "desc" }, skip: p.skip, take: p.take })]);
  return result(rows, total, p);
}

export async function listReviews(actor: Actor, o: PageOpts & { status?: string } = {}) {
  need(actor, "ADMIN_REVIEWS");
  const p = paging(o);
  const where: Prisma.ReviewWhereInput = o.status ? { status: o.status as never } : {};
  const [total, rows] = await Promise.all([db.review.count({ where }), db.review.findMany({ where, include: { client: { select: { firstName: true, lastName: true } }, product: { select: { name: true } }, lender: { select: { companyName: true } } }, orderBy: { createdAt: "desc" }, skip: p.skip, take: p.take })]);
  return result(rows, total, p);
}

export async function listPayouts(actor: Actor, o: PageOpts = {}) {
  need(actor, "ADMIN_PAYOUTS");
  const p = paging(o);
  const [total, rows] = await Promise.all([db.payout.count(), db.payout.findMany({ include: { lender: { select: { companyName: true } } }, orderBy: { createdAt: "desc" }, skip: p.skip, take: p.take })]);
  return result(rows, total, p);
}

export async function listNotificationsAdmin(actor: Actor, o: PageOpts & { channel?: string } = {}) {
  need(actor, "ADMIN_NOTIFICATIONS");
  const p = paging(o);
  const where: Prisma.NotificationWhereInput = o.channel ? { channel: o.channel as never } : {};
  const [total, rows] = await Promise.all([db.notification.count({ where }), db.notification.findMany({ where, include: { user: { select: { firstName: true, lastName: true, accountType: true } } }, orderBy: { createdAt: "desc" }, skip: p.skip, take: p.take })]);
  return result(rows, total, p);
}

export async function listAudit(actor: Actor, o: PageOpts & { q?: string; entity?: string; userId?: string } = {}) {
  need(actor, "ADMIN_AUDIT");
  const p = paging(o, 30);
  const where: Prisma.AuditLogWhereInput = { ...(o.entity ? { entity: o.entity } : {}), ...(o.userId ? { userId: o.userId } : {}), ...(o.q ? { action: { contains: o.q, mode: "insensitive" } } : {}) };
  const [total, rows] = await Promise.all([db.auditLog.count({ where }), db.auditLog.findMany({ where, include: { user: { select: { firstName: true, lastName: true, accountType: true } } }, orderBy: { createdAt: "desc" }, skip: p.skip, take: p.take })]);
  return result(rows, total, p);
}

export async function listStockMovements(actor: Actor, o: PageOpts = {}) {
  need(actor, "ADMIN_STOCK");
  const p = paging(o);
  const [total, rows] = await Promise.all([db.stockMovement.count(), db.stockMovement.findMany({ include: { product: { select: { name: true, lender: { select: { companyName: true } } } } }, orderBy: { createdAt: "desc" }, skip: p.skip, take: p.take })]);
  return result(rows, total, p);
}

export async function listValidations(actor: Actor) {
  need(actor, "ADMIN_PAYOUTS");
  return db.validationAction.findMany({ where: { status: "PENDING" }, include: { requestedBy: { select: { firstName: true, lastName: true } } }, orderBy: { requestedAt: "asc" } });
}

export async function listClientScores(actor: Actor) {
  need(actor, "ADMIN_USERS");
  const rows = await db.hold.groupBy({ by: ["userId"], _count: true, where: { status: { in: ["CONVERTED", "EXPIRED"] } } });
  const out = [];
  for (const r of rows.slice(0, 50)) {
    const rate = await holdNonConversionRate(r.userId);
    const user = await db.user.findUnique({ where: { id: r.userId }, select: { firstName: true, lastName: true, email: true } });
    out.push({ userId: r.userId, user, holds: r._count, rate: rate.rate });
  }
  return out.sort((a, b) => b.rate - a.rate);
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export async function setUserStatus(actor: Actor, userId: string, status: "ACTIVE" | "SUSPENDED" | "DEACTIVATED", reason?: string) {
  need(actor, "ADMIN_USERS");
  if (userId === actor.userId) throw new AppError("FORBIDDEN", "Vous ne pouvez pas modifier votre propre statut.");
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) throw notFound("Utilisateur");
  return transaction(async (tx) => {
    const updated = await tx.user.update({ where: { id: userId }, data: { status } });
    if (status !== "ACTIVE") await revokeUserSessions(tx, userId);
    await audit(tx, { userId: actor.userId, action: `user.${status.toLowerCase()}`, entity: "User", entityId: userId, oldValue: { status: user.status }, newValue: { status, reason }, meta: actor.meta });
    return updated;
  });
}

export async function assignAdminRole(actor: Actor, userId: string, roleCode: string, grant: boolean) {
  need(actor, "ADMIN_ROLES");
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user || user.accountType !== "ADMIN") throw new AppError("VALIDATION_ERROR", "Seuls les comptes administrateurs reçoivent des rôles plateforme.");
  const role = await db.role.findUnique({ where: { key: `SYSTEM:${roleCode}` } });
  if (!role || role.scope !== "PLATFORM") throw notFound("Rôle");
  await transaction(async (tx) => {
    if (grant) await tx.userRole.upsert({ where: { userId_roleId: { userId, roleId: role.id } }, update: {}, create: { userId, roleId: role.id } });
    else await tx.userRole.deleteMany({ where: { userId, roleId: role.id } });
    await audit(tx, { userId: actor.userId, action: "role.assign", entity: "User", entityId: userId, newValue: { role: roleCode, grant }, meta: actor.meta });
  });
}

export async function listPlatformRoles(actor: Actor) {
  need(actor, "ADMIN_ROLES");
  return db.role.findMany({ where: { scope: "PLATFORM" }, include: { permissions: { include: { permission: { select: { code: true } } } }, users: { include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } } } }, orderBy: { name: "asc" } });
}

export const lenderDecision = z.object({ decision: z.enum(["approve", "reject", "suspend", "reactivate"]), reason: z.string().trim().max(500).optional() });

export async function decideLender(actor: Actor, lenderId: string, input: z.infer<typeof lenderDecision>) {
  need(actor, "ADMIN_LENDERS");
  const lender = await db.lender.findUnique({ where: { id: lenderId } });
  if (!lender) throw notFound("Loueur");
  if ((input.decision === "reject" || input.decision === "suspend") && !input.reason) throw new AppError("VALIDATION_ERROR", "Un motif est obligatoire.");
  const status = input.decision === "approve" || input.decision === "reactivate" ? "APPROVED" : input.decision === "reject" ? "REJECTED" : "SUSPENDED";
  return transaction(async (tx) => {
    const updated = await tx.lender.update({ where: { id: lenderId }, data: { status, validatedAt: status === "APPROVED" ? new Date() : lender.validatedAt, rejectionReason: status === "APPROVED" ? null : input.reason } });
    if (status === "SUSPENDED") {
      await tx.product.updateMany({ where: { lenderId, status: "PUBLISHED" }, data: { status: "INACTIVE" } });
      await tx.balanceEntry.updateMany({ where: { lenderId, payoutId: null, amount: { gt: 0 } }, data: { blocked: true } });
    }
    if (status === "APPROVED" && lender.status === "SUSPENDED") await tx.balanceEntry.updateMany({ where: { lenderId, payoutId: null, blocked: true, item: { disputes: { none: { status: { in: ["OPEN", "UNDER_REVIEW", "WAITING_RESPONSE"] } } } } }, data: { blocked: false } });
    await audit(tx, { userId: actor.userId, lenderId, action: `lender.${input.decision}`, entity: "Lender", entityId: lenderId, oldValue: { status: lender.status }, newValue: { status, reason: input.reason }, meta: actor.meta });
    await notifyLender(tx, lenderId, { type: `lender.${input.decision}`, title: status === "APPROVED" ? "Votre entreprise est validée" : status === "REJECTED" ? "Votre demande a été rejetée" : "Votre compte est suspendu", body: input.reason ?? (status === "APPROVED" ? "Vous pouvez publier vos produits." : ""), link: "/loueur/dashboard" });
    return updated;
  });
}

export const categoryInput = z.object({ name: z.string().trim().min(2).max(80), description: z.string().trim().max(300).optional(), icon: z.string().trim().max(40).optional(), imageUrl: z.string().max(500).optional(), parentId: z.string().nullable().optional(), position: z.number().int().min(0).max(999).optional(), active: z.boolean().optional() });

export async function upsertCategory(actor: Actor, id: string | null, input: z.infer<typeof categoryInput>) {
  need(actor, "ADMIN_CATALOG");
  if (input.parentId) {
    const parent = await db.category.findUnique({ where: { id: input.parentId } });
    if (!parent || parent.parentId) throw new AppError("VALIDATION_ERROR", "Une sous-catégorie doit dépendre d'une catégorie racine.");
  }
  return transaction(async (tx) => {
    let category;
    if (id) category = await tx.category.update({ where: { id }, data: input });
    else {
      let slug = slugify(input.name);
      if (await tx.category.findUnique({ where: { slug } })) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
      category = await tx.category.create({ data: { ...input, slug, parentId: input.parentId ?? null } });
    }
    await audit(tx, { userId: actor.userId, action: id ? "category.update" : "category.create", entity: "Category", entityId: category.id, newValue: input, meta: actor.meta });
    return category;
  });
}

export const cityInput = z.object({ name: z.string().trim().min(2).max(80), region: z.string().trim().min(2).max(80), imageUrl: z.string().max(500).optional(), active: z.boolean().optional() });

export async function upsertCity(actor: Actor, id: string | null, input: z.infer<typeof cityInput>) {
  need(actor, "ADMIN_CATALOG");
  return transaction(async (tx) => {
    let city;
    if (id) city = await tx.city.update({ where: { id }, data: input });
    else {
      let slug = slugify(input.name);
      if (await tx.city.findUnique({ where: { slug } })) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
      city = await tx.city.create({ data: { ...input, slug } });
    }
    await audit(tx, { userId: actor.userId, action: id ? "city.update" : "city.create", entity: "City", entityId: city.id, newValue: input, meta: actor.meta });
    return city;
  });
}

export async function getSettingsForAdmin(actor: Actor) {
  need(actor, "ADMIN_SETTINGS");
  const values = await getSettings();
  return Object.entries(SETTING_DEFS).map(([key, def]) => ({ key, group: def.group, label: def.label, description: def.description, type: def.type, options: "options" in def ? def.options : undefined, value: values[key as SettingKey], default: def.default }));
}

export async function updateSetting(actor: Actor, key: string, value: unknown) {
  need(actor, "ADMIN_SETTINGS");
  let valid: number | boolean | string;
  try {
    valid = validateSettingValue(key, value);
  } catch (e) {
    throw new AppError("VALIDATION_ERROR", e instanceof Error ? e.message : "Valeur invalide");
  }
  const def = SETTING_DEFS[key as SettingKey];
  const before = await db.setting.findUnique({ where: { key } });
  await transaction(async (tx) => {
    await tx.setting.upsert({ where: { key }, update: { value: valid, updatedById: actor.userId }, create: { key, value: valid, description: def.description, group: def.group, updatedById: actor.userId } });
    await audit(tx, { userId: actor.userId, action: "setting.update", entity: "Setting", entityId: key, oldValue: { value: before?.value ?? def.default }, newValue: { value: valid }, meta: actor.meta });
  });
  invalidateSettings();
}

export const lenderCommissionInput = z.object({ commissionRateBps: z.number().int().min(0).max(5000).nullable() });

export async function setLenderCommission(actor: Actor, lenderId: string, rate: number | null) {
  need(actor, "ADMIN_COMMISSIONS");
  const lender = await db.lender.findUnique({ where: { id: lenderId } });
  if (!lender) throw notFound("Loueur");
  const updated = await db.lender.update({ where: { id: lenderId }, data: { commissionRateBps: rate } });
  await audit(db, { userId: actor.userId, lenderId, action: "commission.set", entity: "Lender", entityId: lenderId, oldValue: { bps: lender.commissionRateBps }, newValue: { bps: rate }, meta: actor.meta });
  return updated;
}

export async function listSubscriptions(actor: Actor) {
  need(actor, "ADMIN_SUBSCRIPTIONS");
  return db.subscription.findMany({ include: { lender: { select: { companyName: true } } }, orderBy: { createdAt: "desc" }, take: 100 });
}

export const subscriptionInput = z.object({ lenderId: z.string(), plan: z.enum(["FREE", "PRO", "PREMIUM"]), price: z.number().int().min(0), months: z.number().int().min(1).max(36).default(1) });

/** Une seule formule active par loueur : l'abonnement précédent est clôturé et conservé dans l'historique. */
export async function createSubscription(actor: Actor, input: z.infer<typeof subscriptionInput>) {
  need(actor, "ADMIN_SUBSCRIPTIONS");
  return transaction(async (tx) => {
    await tx.subscription.updateMany({ where: { lenderId: input.lenderId, status: "ACTIVE" }, data: { status: "CANCELLED", endsAt: new Date() } });
    const start = new Date();
    const sub = await tx.subscription.create({ data: { lenderId: input.lenderId, plan: input.plan, price: input.price, startsAt: start, endsAt: input.plan === "FREE" ? null : new Date(start.getTime() + input.months * 30 * 86_400_000) } });
    await audit(tx, { userId: actor.userId, lenderId: input.lenderId, action: "subscription.create", entity: "Subscription", entityId: sub.id, newValue: input, meta: actor.meta });
    await notifyLender(tx, input.lenderId, { type: "subscription.changed", title: `Formule ${input.plan} activée`, body: "Votre abonnement a été mis à jour.", link: "/loueur/entreprise" });
    return sub;
  });
}

export async function listPromotions(actor: Actor) {
  need(actor, "ADMIN_PROMOTIONS");
  return db.promotion.findMany({ include: { product: { select: { name: true, lender: { select: { companyName: true } } } } }, orderBy: { startsAt: "desc" }, take: 100 });
}

export const promotionInput = z.object({ productId: z.string(), type: z.enum(["FEATURED", "SPONSORED"]), days: z.number().int().min(1).max(365), amountPaid: z.number().int().min(0).default(0) });

export async function createPromotion(actor: Actor, input: z.infer<typeof promotionInput>) {
  need(actor, "ADMIN_PROMOTIONS");
  const product = await db.product.findUnique({ where: { id: input.productId } });
  if (!product) throw notFound("Produit");
  const now = new Date();
  const promo = await db.promotion.create({ data: { productId: input.productId, type: input.type, startsAt: now, endsAt: addDays(now, input.days), amountPaid: input.amountPaid } });
  await audit(db, { userId: actor.userId, lenderId: product.lenderId, action: "promotion.create", entity: "Promotion", entityId: promo.id, newValue: input, meta: actor.meta });
  return promo;
}

export async function togglePromotion(actor: Actor, id: string, active: boolean) {
  need(actor, "ADMIN_PROMOTIONS");
  return db.promotion.update({ where: { id }, data: { active } });
}

export async function notifyBroadcast(actor: Actor, userIds: string[], title: string, body: string) {
  need(actor, "ADMIN_NOTIFICATIONS");
  await notifyUsers(db, userIds, { type: "admin.message", title, body });
}
