import { randomInt, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { CashSettlementStatus, Prisma, ReservationStatus } from "@prisma/client";
import { db, lockReservation, transaction, type Tx } from "@/lib/db";
import { AppError, forbidden, notFound } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { sum, formatFcfa } from "@/lib/money";
import { todayUTC } from "@/lib/dates";
import { getSettings } from "@/lib/settings";
import { can, type Actor } from "@/lib/auth/actor";
import { executeRefund } from "./finance";
import { issueCreditNote } from "./invoices";
import { notifyAdmins, notifyLender, notifyUsers } from "./notifications";
import { resolveScope, transitionItems } from "./reservations";

/**
 * Mode « acompte en ligne + solde en espèces ».
 * Le client paie en ligne la commission (avec un minimum) et la caution ; il règle le reste au loueur à la remise du matériel.
 * Chaque loueur concerné a un solde en espèces par réservation, protégé par un code de remise que seul le client connaît :
 * le client le donne une fois le solde payé, le loueur le saisit, ce qui sert de preuve aux deux parties.
 */

const INACTIVE: ReservationStatus[] = ["CANCELLED", "REFUNDED"];
/** Lignes pour lesquelles le loueur peut encaisser le solde (commande acceptée, matériel pas encore remis). */
const HANDOVER_STATUSES: ReservationStatus[] = ["CONFIRMED", "READY", "DELIVERING"];
export const CASH_PERMISSIONS = ["ORDER_STATUS_UPDATE", "DELIVERY_UPDATE"];

export const newHandoverCode = (): string => String(randomInt(0, 10_000)).padStart(4, "0");

function sameCode(expected: string, given: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(given.trim());
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Recalcule le solde en espèces d'un loueur à partir de ses lignes actives (création, modification, annulation).
 * Un solde déjà encaissé, signalé impayé ou annulé n'est plus modifié.
 */
export async function syncCashSettlement(tx: Tx, reservationId: string, lenderId: string, opts: { deliveryDue?: number } = {}) {
  const items = await tx.reservationItem.findMany({ where: { reservationId, lenderId }, select: { status: true, paymentMode: true, cashDue: true } });
  const existing = await tx.cashSettlement.findUnique({ where: { reservationId_lenderId: { reservationId, lenderId } } });
  if (!existing && !items.some((i) => i.paymentMode === "DEPOSIT_CASH")) return null;
  const active = items.filter((i) => !INACTIVE.includes(i.status));
  const deliveryDue = active.length === 0 ? 0 : (opts.deliveryDue ?? existing?.deliveryDue ?? 0);
  const amountDue = sum(active.filter((i) => i.paymentMode === "DEPOSIT_CASH").map((i) => i.cashDue)) + deliveryDue;
  if (!existing) {
    if (amountDue <= 0) return null;
    return tx.cashSettlement.create({ data: { reservationId, lenderId, amountDue, deliveryDue, code: newHandoverCode() } });
  }
  if (existing.status !== "PENDING") return existing;
  return tx.cashSettlement.update({ where: { id: existing.id }, data: { amountDue, deliveryDue, ...(active.length === 0 ? { status: "CANCELLED" } : {}) } });
}

/** Total encore attendu en espèces pour une réservation (soldes non annulés). */
export async function cashTotalFor(tx: Tx, reservationId: string): Promise<number> {
  const rows = await tx.cashSettlement.findMany({ where: { reservationId, status: { in: ["PENDING", "PAID"] } }, select: { amountDue: true } });
  return sum(rows.map((r) => r.amountDue));
}

/** Annule les soldes en espèces d'une réservation qui n'a jamais été payée en ligne (HOLD expiré ou libéré). */
export async function cancelCashSettlements(tx: Tx, reservationId: string) {
  await tx.cashSettlement.updateMany({ where: { reservationId, status: "PENDING" }, data: { status: "CANCELLED" } });
}

/** Garde : le matériel d'un loueur en mode espèces ne peut être remis (ou livré) qu'une fois le solde encaissé. */
export async function assertCashSettled(tx: Tx, reservationId: string, lenderId: string) {
  const s = await tx.cashSettlement.findUnique({ where: { reservationId_lenderId: { reservationId, lenderId } } });
  if (s && s.status === "PENDING" && s.amountDue > 0) {
    throw new AppError("CASH_NOT_CONFIRMED", `Le client doit d'abord vous régler ${formatFcfa(s.amountDue)} en espèces. Saisissez son code de remise pour confirmer l'encaissement.`);
  }
}

/** Refuse une opération qui contredirait un solde déjà payé en espèces (le remboursement se ferait hors plateforme). */
export async function assertCashNotCollected(client: Tx | typeof db, reservationId: string, lenderIds: string[], action: string) {
  const paid = await client.cashSettlement.findFirst({ where: { reservationId, lenderId: { in: lenderIds }, status: "PAID" }, include: { lender: { select: { companyName: true } } } });
  if (paid) throw new AppError("CONFLICT", `Le solde en espèces a déjà été payé à ${paid.lender.companyName} : ${action} passe par le support LOC'CONNECT.`);
}

function assertLender(actor: Actor): asserts actor is Actor & { lenderId: string } {
  if (actor.accountType !== "LENDER" || !actor.lenderId) throw forbidden();
  if (!CASH_PERMISSIONS.some((p) => can(actor, p))) throw forbidden("Votre rôle ne permet pas d'encaisser un paiement.");
}

export const confirmCashInput = z.object({ code: z.string().trim().regex(/^\d{4}$/, "Le code de remise comporte 4 chiffres.") });

/**
 * Le loueur confirme l'encaissement du solde en saisissant le code de remise du client.
 * Un code erroné est compté (même si la requête échoue) ; au-delà du nombre d'essais permis, l'encaissement est bloqué.
 */
export async function confirmCashPayment(actor: Actor, reservationId: string, code: string) {
  assertLender(actor);
  await resolveScope(actor, reservationId);
  const settings = await getSettings();
  const maxAttempts = settings["cash.max_code_attempts"];

  const outcome = await transaction(async (tx) => {
    await lockReservation(tx, reservationId);
    const s = await tx.cashSettlement.findUnique({ where: { reservationId_lenderId: { reservationId, lenderId: actor.lenderId } }, include: { reservation: { select: { reference: true, clientId: true } }, lender: { select: { companyName: true } } } });
    if (!s || s.amountDue <= 0) throw new AppError("CONFLICT", "Aucun solde en espèces n'est attendu pour cette réservation.");
    if (s.status === "PAID") throw new AppError("CONFLICT", "Le solde en espèces a déjà été confirmé.");
    if (s.status !== "PENDING") throw new AppError("CONFLICT", "Ce solde en espèces n'est plus attendu.");
    const items = await tx.reservationItem.findMany({ where: { reservationId, lenderId: actor.lenderId, status: { notIn: INACTIVE } } });
    if (!items.some((i) => HANDOVER_STATUSES.includes(i.status))) throw new AppError("INVALID_TRANSITION", "Le solde s'encaisse à la remise, une fois la commande confirmée.");
    if (s.failedAttempts >= maxAttempts) throw new AppError("CASH_CODE_LOCKED", "Trop de codes erronés : l'encaissement est bloqué. Contactez le support LOC'CONNECT.");

    if (!sameCode(s.code, code)) {
      const failedAttempts = s.failedAttempts + 1;
      await tx.cashSettlement.update({ where: { id: s.id }, data: { failedAttempts } });
      await audit(tx, { userId: actor.userId, lenderId: actor.lenderId, action: "cash.code_failed", entity: "CashSettlement", entityId: s.id, newValue: { failedAttempts }, meta: actor.meta });
      if (failedAttempts >= maxAttempts) {
        await notifyAdmins(tx, { type: "cash.locked", title: `Encaissement bloqué : ${s.reservation.reference}`, body: `${s.lender.companyName} a saisi ${failedAttempts} codes de remise erronés.`, link: `/admin/especes` }, "ADMIN_PAYMENTS");
      }
      return { ok: false as const, remaining: maxAttempts - failedAttempts };
    }

    const now = new Date();
    const updated = await tx.cashSettlement.update({ where: { id: s.id }, data: { status: "PAID", confirmedAt: now, confirmedById: actor.userId } });
    await audit(tx, { userId: actor.userId, lenderId: actor.lenderId, action: "cash.confirm", entity: "CashSettlement", entityId: s.id, newValue: { amount: s.amountDue }, meta: actor.meta });
    await notifyUsers(tx, [s.reservation.clientId], {
      type: "cash.receipt",
      title: `Reçu : ${formatFcfa(s.amountDue)} payés en espèces`,
      body: `${s.lender.companyName} confirme avoir reçu ${formatFcfa(s.amountDue)} en espèces pour la réservation ${s.reservation.reference}.`,
      link: `/mes-reservations/${reservationId}`,
    });
    return { ok: true as const, settlement: updated };
  });

  if (!outcome.ok) {
    if (outcome.remaining <= 0) throw new AppError("CASH_CODE_LOCKED", "Code erroné. Trop d'essais : l'encaissement est bloqué, contactez le support LOC'CONNECT.");
    throw new AppError("CASH_CODE_INVALID", `Code de remise erroné. ${outcome.remaining} essai${outcome.remaining > 1 ? "s" : ""} restant${outcome.remaining > 1 ? "s" : ""}.`);
  }
  return outcome.settlement;
}

export const reportUnpaidInput = z.object({ reason: z.string().trim().min(5).max(500) });

/**
 * Le client n'a pas payé le solde à la remise : le loueur garde son matériel et le signale.
 * Les lignes du loueur sont annulées, la caution est restituée au client, l'acompte payé en ligne n'est pas remboursé.
 * L'administration est prévenue et peut revenir sur le signalement en cas de contestation.
 */
export async function reportCashUnpaid(actor: Actor, reservationId: string, reason: string) {
  assertLender(actor);
  await resolveScope(actor, reservationId);
  return transaction(async (tx) => {
    await lockReservation(tx, reservationId);
    const s = await tx.cashSettlement.findUnique({ where: { reservationId_lenderId: { reservationId, lenderId: actor.lenderId } }, include: { reservation: true, lender: { select: { companyName: true } } } });
    if (!s || s.status !== "PENDING" || s.amountDue <= 0) throw new AppError("CONFLICT", "Aucun solde en espèces n'est en attente pour cette réservation.");
    const items = await tx.reservationItem.findMany({ where: { reservationId, lenderId: actor.lenderId, status: { notIn: INACTIVE } }, include: { deposit: true } });
    if (items.length === 0 || items.some((i) => !HANDOVER_STATUSES.includes(i.status))) {
      throw new AppError("INVALID_TRANSITION", "Le non-paiement se signale à la remise, avant que le matériel soit remis au client.");
    }
    const firstDay = new Date(Math.min(...items.map((i) => i.startDate.getTime())));
    if (todayUTC() < firstDay) throw new AppError("CONFLICT", "Le non-paiement ne peut être signalé qu'à partir du premier jour de location.");

    const payment = await tx.payment.findFirst({ where: { reservationId, kind: "INITIAL", status: { in: ["PAID", "PARTIALLY_REFUNDED"] } } });
    const now = new Date();
    let depositBack = 0;
    for (const item of items) {
      if (item.status === "DELIVERING") await transitionItems(tx, reservationId, "READY", { actorId: actor.userId, itemIds: [item.id], note: "Retour du livreur : solde non payé" });
      if (payment && item.deposit?.status === "HELD" && item.deposit.amount > 0) {
        await executeRefund(tx, { payment, kind: "DEPOSIT_RELEASE", amount: item.deposit.amount, reason: `Caution restituée (solde en espèces non payé, ${s.reservation.reference})`, requestedById: actor.userId, impacts: [] });
        await tx.deposit.update({ where: { itemId: item.id }, data: { status: "RELEASED", releasedAmount: item.deposit.amount, settledAt: now, reason: "Solde en espèces non payé" } });
        depositBack += item.deposit.amount;
      }
      await transitionItems(tx, reservationId, "CANCELLED", { actorId: actor.userId, itemIds: [item.id], note: `Solde en espèces non payé : ${reason}` });
    }
    await tx.delivery.updateMany({ where: { reservationId, lenderId: actor.lenderId, status: { in: ["PENDING", "PREPARING", "OUT_FOR_DELIVERY"] } }, data: { status: "FAILED", notes: "Solde en espèces non payé" } });
    const updated = await tx.cashSettlement.update({ where: { id: s.id }, data: { status: "UNPAID", reportedAt: now, reportedById: actor.userId, note: reason } });
    // Avoir du solde jamais payé : seul l'acompte payé en ligne reste dû au titre de la facture.
    await issueCreditNote(tx, {
      sourceKey: `CREDIT:UNPAID:${s.id}`,
      reservationId,
      lenderId: actor.lenderId,
      lines: [
        ...items.filter((i) => i.cashDue > 0).map((i) => ({ label: `Solde en espèces non payé : ${i.productName}`, detail: `${i.quantity} x, location annulée à la remise`, quantity: 1, unitPrice: i.cashDue, amount: i.cashDue })),
        ...(s.deliveryDue > 0 ? [{ label: "Livraison non effectuée", quantity: 1, unitPrice: s.deliveryDue, amount: s.deliveryDue }] : []),
      ],
      reason: "Solde en espèces non payé à la remise ; l'acompte payé en ligne est conservé.",
    });
    const remaining = await tx.reservationItem.count({ where: { reservationId, status: { notIn: INACTIVE } } });
    if (remaining === 0) await tx.reservation.update({ where: { id: reservationId }, data: { cancelledAt: now, cancellationReason: "Solde en espèces non payé à la remise" } });

    await audit(tx, { userId: actor.userId, lenderId: actor.lenderId, action: "cash.unpaid", entity: "CashSettlement", entityId: s.id, newValue: { amount: s.amountDue, reason, depositBack }, meta: actor.meta });
    await notifyUsers(tx, [s.reservation.clientId], {
      type: "cash.unpaid",
      title: `Réservation ${s.reservation.reference} annulée chez ${s.lender.companyName}`,
      body: `Le loueur signale que le solde de ${formatFcfa(s.amountDue)} en espèces n'a pas été payé à la remise. ${depositBack > 0 ? `Votre caution de ${formatFcfa(depositBack)} est restituée ; ` : ""}l'acompte payé en ligne n'est pas remboursé. Si c'est une erreur, contactez le support.`,
      link: `/mes-reservations/${reservationId}`,
    });
    await notifyAdmins(tx, { type: "cash.unpaid", title: `Solde en espèces impayé : ${s.reservation.reference}`, body: `${s.lender.companyName} : ${reason}`, link: `/admin/especes` }, "ADMIN_PAYMENTS");
    return updated;
  });
}

export const adminCashInput = z.object({
  action: z.enum(["MARK_PAID", "UNLOCK"]),
  note: z.string().trim().min(3).max(500),
});

/** Support : débloquer le code après trop d'essais, ou constater un paiement en espèces confirmé par les deux parties. */
export async function adminCashAction(actor: Actor, settlementId: string, input: z.infer<typeof adminCashInput>) {
  if (actor.accountType !== "ADMIN" || !can(actor, "ADMIN_PAYMENTS")) throw forbidden();
  return transaction(async (tx) => {
    const s = await tx.cashSettlement.findUnique({ where: { id: settlementId }, include: { reservation: { select: { id: true, reference: true, clientId: true } }, lender: { select: { companyName: true } } } });
    if (!s) throw notFound("Solde en espèces");
    if (s.status !== "PENDING") throw new AppError("CONFLICT", "Ce solde n'est plus en attente.");
    const data: Prisma.CashSettlementUpdateInput =
      input.action === "UNLOCK" ? { failedAttempts: 0, note: input.note } : { status: "PAID", confirmedAt: new Date(), confirmedById: actor.userId, note: input.note };
    const updated = await tx.cashSettlement.update({ where: { id: s.id }, data });
    await audit(tx, { userId: actor.userId, action: input.action === "UNLOCK" ? "cash.unlock" : "cash.admin_paid", entity: "CashSettlement", entityId: s.id, oldValue: { status: s.status, failedAttempts: s.failedAttempts }, newValue: input, meta: actor.meta });
    const body = input.action === "UNLOCK" ? `La saisie du code de remise est débloquée pour ${s.reservation.reference}.` : `L'administration a constaté le paiement de ${formatFcfa(s.amountDue)} en espèces pour ${s.reservation.reference}.`;
    await notifyLender(tx, s.lenderId, { type: "cash.admin", title: "Solde en espèces mis à jour", body, link: `/loueur/reservations/${s.reservation.id}` }, "ORDER_VIEW");
    if (input.action === "MARK_PAID") await notifyUsers(tx, [s.reservation.clientId], { type: "cash.receipt", title: `Reçu : ${formatFcfa(s.amountDue)} payés en espèces`, body: `Paiement en espèces à ${s.lender.companyName} enregistré pour ${s.reservation.reference}.`, link: `/mes-reservations/${s.reservation.id}` });
    return updated;
  });
}

export async function listCashSettlements(actor: Actor, opts: { status?: CashSettlementStatus; q?: string; page?: number; pageSize?: number } = {}) {
  if (actor.accountType !== "ADMIN" || !can(actor, "ADMIN_PAYMENTS")) throw forbidden();
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = opts.pageSize ?? 20;
  const where: Prisma.CashSettlementWhereInput = {
    ...(opts.status ? { status: opts.status } : {}),
    ...(opts.q ? { OR: [{ reservation: { reference: { contains: opts.q, mode: "insensitive" } } }, { lender: { companyName: { contains: opts.q, mode: "insensitive" } } }] } : {}),
    reservation: { status: { notIn: ["HOLD", "PENDING_PAYMENT", "DRAFT"] } },
  };
  const [total, rows, totals] = await Promise.all([
    db.cashSettlement.count({ where }),
    db.cashSettlement.findMany({
      where,
      include: { reservation: { select: { id: true, reference: true, client: { select: { firstName: true, lastName: true, phone: true } } } }, lender: { select: { companyName: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.cashSettlement.groupBy({ by: ["status"], where: { reservation: { status: { notIn: ["HOLD", "PENDING_PAYMENT", "DRAFT"] } } }, _sum: { amountDue: true }, _count: true }),
  ]);
  return { rows, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)), totals };
}

/** Lecture côté loueur et client : le code n'est jamais renvoyé au loueur. */
export async function cashSettlementsForActor(actor: Actor, reservationId: string) {
  const scope = await resolveScope(actor, reservationId);
  const rows = await db.cashSettlement.findMany({
    where: { reservationId, ...(scope.kind === "lender" ? { lenderId: scope.lenderId } : {}) },
    include: { lender: { select: { id: true, companyName: true } } },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((r) => (scope.kind === "lender" ? { ...r, code: null } : r));
}
