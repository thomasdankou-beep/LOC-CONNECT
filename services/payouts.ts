import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db, transaction } from "@/lib/db";
import { AppError, forbidden, notFound } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { reference } from "@/lib/ids";
import { sum, formatFcfa } from "@/lib/money";
import { can, type Actor } from "@/lib/auth/actor";
import { recordTransaction } from "./finance";
import { notifyLender } from "./notifications";

export type LenderBalance = {
  /** Montants gelés : fin de location + délai de gel pas encore atteint. */
  frozen: number;
  /** Montants bloqués par un litige ou une contestation. */
  blocked: number;
  /** Montants disponibles au versement. */
  available: number;
  /** Déductions en attente (remboursements clients) à compenser sur le prochain versement. */
  owed: number;
  /** Montant qui serait versé maintenant : disponible moins déductions. */
  payable: number;
  paidTotal: number;
};

export async function lenderBalance(lenderId: string, now = new Date()): Promise<LenderBalance> {
  const [entries, paid] = await Promise.all([
    db.balanceEntry.findMany({ where: { lenderId, payoutId: null }, select: { amount: true, availableAt: true, blocked: true } }),
    db.payout.aggregate({ where: { lenderId, status: "PAID" }, _sum: { amount: true } }),
  ]);
  let frozen = 0;
  let blocked = 0;
  let available = 0;
  let owed = 0;
  for (const e of entries) {
    if (e.amount < 0) owed += -e.amount;
    else if (e.blocked) blocked += e.amount;
    else if (e.availableAt > now) frozen += e.amount;
    else available += e.amount;
  }
  return { frozen, blocked, available, owed, payable: Math.max(0, available - owed), paidTotal: paid._sum.amount ?? 0 };
}

export async function listBalanceEntries(lenderId: string, opts: { page?: number; pageSize?: number } = {}) {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = opts.pageSize ?? 20;
  const where = { lenderId };
  const [total, rows] = await Promise.all([
    db.balanceEntry.count({ where }),
    db.balanceEntry.findMany({ where, include: { item: { select: { productName: true, reservation: { select: { reference: true, id: true } } } } }, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
  ]);
  return { rows, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function listLenderPayouts(lenderId: string) {
  return db.payout.findMany({ where: { lenderId }, orderBy: { createdAt: "desc" }, take: 50 });
}

/** Revenus nets du loueur par mois (part loueur après commission), sur les 6 derniers mois. */
export async function lenderRevenueByMonth(lenderId: string, months = 6) {
  const rows = await db.$queryRaw<{ month: Date; net: bigint; gross: bigint; commission: bigint }[]>`
    SELECT date_trunc('month', pa."createdAt") AS month,
           COALESCE(SUM(pa."netAmount"), 0)::bigint AS net,
           COALESCE(SUM(pa."rentalAmount" + pa."deliveryAmount"), 0)::bigint AS gross,
           COALESCE(SUM(pa."commissionAmount"), 0)::bigint AS commission
    FROM "PaymentAllocation" pa
    WHERE pa."lenderId" = ${lenderId} AND pa."createdAt" >= (date_trunc('month', now()) - (${months - 1} * interval '1 month'))
    GROUP BY 1 ORDER BY 1`;
  return rows.map((r) => ({ month: r.month.toISOString().slice(0, 7), net: Number(r.net), gross: Number(r.gross), commission: Number(r.commission) }));
}

/**
 * Versement à un loueur : somme des montants disponibles (non gelés, non bloqués) moins les déductions en attente.
 * Les déductions compensées passent en OFFSET. Aucun versement si le solde net est nul ou négatif.
 */
export async function runPayout(actor: Actor, lenderId: string) {
  if (actor.accountType !== "ADMIN" || !can(actor, "ADMIN_PAYOUTS")) throw forbidden();
  return transaction(async (tx) => {
    const lender = await tx.lender.findUnique({ where: { id: lenderId } });
    if (!lender) throw notFound("Loueur");
    if (!lender.payoutAccount) throw new AppError("CONFLICT", "Le loueur n'a pas renseigné de coordonnées de versement.");
    const now = new Date();
    const entries = await tx.balanceEntry.findMany({ where: { lenderId, payoutId: null, OR: [{ amount: { lt: 0 } }, { amount: { gt: 0 }, blocked: false, availableAt: { lte: now } }] } });
    const total = sum(entries.map((e) => e.amount));
    if (entries.length === 0 || total <= 0) return null;
    const payout = await tx.payout.create({ data: { reference: reference("VRS", 8), lenderId, amount: total, status: "PAID", processedById: actor.userId, paidAt: now } });
    await tx.balanceEntry.updateMany({ where: { id: { in: entries.map((e) => e.id) } }, data: { payoutId: payout.id } });
    const negativeIds = entries.filter((e) => e.amount < 0).map((e) => e.id);
    if (negativeIds.length) {
      await tx.lenderReimbursement.updateMany({ where: { balanceEntryId: { in: negativeIds }, status: "TO_RECOVER" }, data: { status: "OFFSET", recoveredAt: now } });
    }
    await recordTransaction(tx, { type: "PAYOUT", direction: "OUT", amount: total, lenderId, payoutId: payout.id, createdById: actor.userId, metadata: { entries: entries.length, offset: sum(entries.filter((e) => e.amount < 0).map((e) => -e.amount)) } });
    await audit(tx, { userId: actor.userId, lenderId, action: "payout.run", entity: "Payout", entityId: payout.id, newValue: { amount: total, reference: payout.reference }, meta: actor.meta });
    await notifyLender(tx, lenderId, { type: "payout.paid", title: `Versement ${payout.reference}`, body: `${formatFcfa(total)} ont été versés sur votre compte (versement simulé).`, link: "/loueur/versements" }, "PAYOUT_VIEW");
    return payout;
  });
}

export async function pendingPayouts(now = new Date()) {
  const lenders = await db.lender.findMany({ where: { balanceEntries: { some: { payoutId: null } } }, select: { id: true, companyName: true, payoutAccount: true, status: true } });
  const rows = [];
  for (const l of lenders) {
    const balance = await lenderBalance(l.id, now);
    rows.push({ lender: l, balance });
  }
  return rows.sort((a, b) => b.balance.payable - a.balance.payable);
}

export async function runAllPayouts(actor: Actor) {
  const pending = await pendingPayouts();
  const paid = [];
  for (const row of pending) {
    if (row.balance.payable <= 0 || !row.lender.payoutAccount) continue;
    const p = await runPayout(actor, row.lender.id);
    if (p) paid.push(p);
  }
  return paid;
}

export async function listRecoveries(opts: { status?: string; lenderId?: string; page?: number; pageSize?: number } = {}) {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = opts.pageSize ?? 20;
  const where: Prisma.LenderReimbursementWhereInput = { ...(opts.status ? { status: opts.status as never } : { status: { not: "NOT_NEEDED" } }), ...(opts.lenderId ? { lenderId: opts.lenderId } : {}) };
  const [total, rows] = await Promise.all([
    db.lenderReimbursement.count({ where }),
    db.lenderReimbursement.findMany({ where, include: { lender: { select: { companyName: true } }, refund: { select: { reference: true, reservation: { select: { reference: true } } } } }, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
  ]);
  return { rows, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

export const recoveryUpdate = z.object({ note: z.string().trim().max(500).optional() });

/** Recouvrement manuel : le loueur a remboursé la plateforme hors versement. Neutralise la déduction par une écriture miroir. */
export async function markRecovered(actor: Actor, reimbursementId: string, note?: string) {
  if (actor.accountType !== "ADMIN" || !can(actor, "ADMIN_RECOVERIES")) throw forbidden();
  return transaction(async (tx) => {
    const r = await tx.lenderReimbursement.findUnique({ where: { id: reimbursementId } });
    if (!r) throw notFound("Recouvrement");
    if (r.status !== "TO_RECOVER") throw new AppError("CONFLICT", "Ce recouvrement n'est plus à traiter.");
    const group = await tx.payout.create({ data: { reference: reference("REC", 8), lenderId: r.lenderId, amount: 0, status: "PAID", processedById: actor.userId, paidAt: new Date() } });
    if (r.balanceEntryId) await tx.balanceEntry.update({ where: { id: r.balanceEntryId }, data: { payoutId: group.id } });
    await tx.balanceEntry.create({ data: { lenderId: r.lenderId, kind: "MANUAL_RECOVERY", amount: r.impactedAmount, availableAt: new Date(), payoutId: group.id, note: note ?? "Recouvrement manuel" } });
    await recordTransaction(tx, { type: "RECOVERY", direction: "IN", amount: r.impactedAmount, lenderId: r.lenderId, refundId: r.refundId, createdById: actor.userId, metadata: { reimbursementId } });
    const updated = await tx.lenderReimbursement.update({ where: { id: r.id }, data: { status: "RECOVERED", recoveredAt: new Date(), note: note ?? r.note } });
    await audit(tx, { userId: actor.userId, lenderId: r.lenderId, action: "recovery.recovered", entity: "LenderReimbursement", entityId: r.id, newValue: { amount: r.impactedAmount, note }, meta: actor.meta });
    await notifyLender(tx, r.lenderId, { type: "recovery.closed", title: "Recouvrement clôturé", body: `${formatFcfa(r.impactedAmount)} ont été enregistrés comme recouvrés.`, link: "/loueur/versements" }, "PAYOUT_VIEW");
    return updated;
  });
}
