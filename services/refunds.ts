import { z } from "zod";
import type { Prisma, ReservationStatus } from "@prisma/client";
import { db, lockReservation, transaction, type DbOrTx } from "@/lib/db";
import { AppError, forbidden, notFound } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { hoursUntil } from "@/lib/dates";
import { prorate, sum, formatFcfa } from "@/lib/money";
import { getSettings, type Settings } from "@/lib/settings";
import { CANCELLABLE_STATUSES } from "@/lib/state-machine";
import { can, type Actor } from "@/lib/auth/actor";
import { refundPercentFor } from "./pricing";
import { executeRefund, recordTransaction, type LenderImpact } from "./finance";
import { notifyLender, notifyUsers } from "./notifications";
import { transitionItems } from "./reservations";
import { assertCashNotCollected, syncCashSettlement } from "./cash";
import { issueCreditNote, type InvoiceLine } from "./invoices";

export const cancelInput = z.object({
  itemIds: z.array(z.string()).optional(),
  reason: z.string().trim().min(3).max(500),
  /** Réservé à l'administration : pourcentage de remboursement imposé, quelle que soit la politique. */
  refundPercent: z.number().int().min(0).max(100).optional(),
});
export type CancelInput = z.infer<typeof cancelInput>;

type ItemRow = Prisma.ReservationItemGetPayload<{ include: { deposit: true } }>;

export type CancellationLine = {
  itemId: string;
  lenderId: string;
  productName: string;
  percent: number;
  hoursBeforeStart: number;
  rentalRefund: number;
  commissionRefund: number;
  lenderDeduction: number;
  depositRefund: number;
};

export type CancellationPlan = {
  lines: CancellationLine[];
  deliveryRefunds: { lenderId: string; refund: number; lenderDeduction: number }[];
  rentalTotal: number;
  deliveryTotal: number;
  depositTotal: number;
  clientTotal: number;
  /** Solde qui ne sera plus à payer en espèces au loueur (lignes en mode espèces). */
  cashCancelled: number;
  policyName: string;
};

/**
 * Calcul pur d'une annulation : règle de la politique selon le délai avant le début, commission remboursée au prorata
 * (selon le paramètre commercial), caution intégralement restituée, frais de livraison remboursés quand toutes les lignes
 * d'un loueur sont annulées.
 */
export function planCancellation(input: {
  items: ItemRow[];
  allItems: { id: string; lenderId: string; status: ReservationStatus; commission: number }[];
  deliveries: { lenderId: string; fee: number }[];
  allocations: { lenderId: string; commissionAmount: number }[];
  rules: { minHoursBefore: number; refundPercent: number }[];
  policyName: string;
  settings: Pick<Settings, "commission.refund_policy">;
  now: Date;
  percentOverride?: number;
}): CancellationPlan {
  const proportional = input.settings["commission.refund_policy"] === "PROPORTIONAL";
  const lines: CancellationLine[] = input.items.map((item) => {
    const hours = hoursUntil(item.startDate, input.now);
    const percent = input.percentOverride ?? refundPercentFor(input.rules, hours);
    // Seule la part payée en ligne est remboursable ; en mode espèces, le solde n'a pas encore été payé.
    const rentalRefund = prorate(item.subtotal - item.cashDue, percent, 100);
    const commissionRefund = proportional ? prorate(item.commission, percent, 100) : 0;
    const depositRefund = item.deposit && item.deposit.status === "HELD" ? item.deposit.amount : 0;
    return { itemId: item.id, lenderId: item.lenderId, productName: item.productName, percent, hoursBeforeStart: Math.round(hours), rentalRefund, commissionRefund, lenderDeduction: rentalRefund - commissionRefund, depositRefund };
  });

  const cancelledIds = new Set(input.items.map((i) => i.id));
  const deliveryRefunds: CancellationPlan["deliveryRefunds"] = [];
  for (const d of input.deliveries) {
    if (d.fee <= 0) continue;
    const lenderItems = input.allItems.filter((i) => i.lenderId === d.lenderId && !["CANCELLED", "REFUNDED"].includes(i.status));
    if (lenderItems.length === 0 || !lenderItems.every((i) => cancelledIds.has(i.id))) continue;
    const percent = lines.find((l) => l.lenderId === d.lenderId)?.percent ?? 0;
    const refund = prorate(d.fee, percent, 100);
    const alloc = input.allocations.find((a) => a.lenderId === d.lenderId);
    const deliveryCommission = alloc ? Math.max(0, alloc.commissionAmount - sum(input.allItems.filter((i) => i.lenderId === d.lenderId).map((i) => i.commission))) : 0;
    const commissionRefund = proportional ? prorate(deliveryCommission, percent, 100) : 0;
    deliveryRefunds.push({ lenderId: d.lenderId, refund, lenderDeduction: refund - commissionRefund });
  }

  const rentalTotal = sum(lines.map((l) => l.rentalRefund));
  const deliveryTotal = sum(deliveryRefunds.map((d) => d.refund));
  const depositTotal = sum(lines.map((l) => l.depositRefund));
  const cashCancelled = sum(input.items.map((i) => i.cashDue));
  return { lines, deliveryRefunds, rentalTotal, deliveryTotal, depositTotal, clientTotal: rentalTotal + deliveryTotal + depositTotal, cashCancelled, policyName: input.policyName };
}

async function loadPlan(client: DbOrTx, actor: Actor, reservationId: string, input: Pick<CancelInput, "itemIds" | "refundPercent">) {
  const settings = await getSettings(client);
  const reservation = await client.reservation.findUnique({ where: { id: reservationId }, include: { items: { include: { deposit: true } }, deliveries: true, cashSettlements: true } });
  if (!reservation) throw notFound("Réservation");

  const isClient = actor.accountType === "CLIENT";
  const isAdmin = actor.accountType === "ADMIN";
  const isLender = actor.accountType === "LENDER";
  if (isClient && reservation.clientId !== actor.userId) throw forbidden();
  if (isAdmin && !(can(actor, "ADMIN_REFUNDS") || can(actor, "ADMIN_RESERVATIONS"))) throw forbidden();
  if (isLender && (!actor.lenderId || !can(actor, "ORDER_VALIDATE"))) throw forbidden();
  if (input.refundPercent != null && !isAdmin) throw forbidden("Seule l'administration peut imposer un pourcentage de remboursement.");

  let items = reservation.items.filter((i) => (input.itemIds ? input.itemIds.includes(i.id) : true));
  if (isLender) items = items.filter((i) => i.lenderId === actor.lenderId);
  if (input.itemIds && items.length !== input.itemIds.length) throw forbidden("Certaines lignes ne vous appartiennent pas.");
  items = items.filter((i) => !["CANCELLED", "REFUNDED"].includes(i.status));
  if (items.length === 0) throw new AppError("CONFLICT", "Aucune ligne annulable.");
  const blocked = items.find((i) => !CANCELLABLE_STATUSES.includes(i.status));
  if (blocked) throw new AppError("INVALID_TRANSITION", `${blocked.productName} ne peut plus être annulé (statut ${blocked.status}).`);
  if (!isAdmin) await assertCashNotCollected(client, reservationId, [...new Set(items.map((i) => i.lenderId))], "l'annulation");

  const policy = await client.cancellationPolicy.findFirst({ where: { active: true }, orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }], include: { rules: true } });
  const allocations = await client.paymentAllocation.findMany({ where: { reservationId }, select: { lenderId: true, commissionAmount: true } });
  const plan = planCancellation({
    items,
    allItems: reservation.items.map((i) => ({ id: i.id, lenderId: i.lenderId, status: i.status, commission: i.commission })),
    // Livraison d'un loueur en mode espèces : seule sa part en ligne (commission éventuelle) est remboursable.
    deliveries: reservation.deliveries.map((d) => ({ lenderId: d.lenderId, fee: d.fee - (reservation.cashSettlements.find((c) => c.lenderId === d.lenderId)?.deliveryDue ?? 0) })),
    allocations,
    rules: policy?.rules ?? [],
    policyName: policy?.name ?? "Aucune politique",
    settings,
    now: new Date(),
    percentOverride: isLender ? 100 : input.refundPercent,
  });
  return { reservation, items, plan, isClient, isAdmin, isLender };
}

export async function previewCancellation(actor: Actor, reservationId: string, input: Pick<CancelInput, "itemIds" | "refundPercent"> = {}) {
  return (await loadPlan(db, actor, reservationId, input)).plan;
}

/**
 * Annule des lignes (ou toute la réservation) et rembourse selon la politique. Pour chaque loueur la part remboursée est déduite
 * de son solde ; s'il a déjà été versé, une ligne de recouvrement est créée. L'historique de la règle appliquée est conservé.
 */
export async function cancelReservation(actor: Actor, reservationId: string, input: CancelInput) {
  const { reservation: pre } = await loadPlan(db, actor, reservationId, input);
  void pre;
  return transaction(async (tx) => {
    await lockReservation(tx, reservationId);
    const { reservation, items, plan, isLender } = await loadPlan(tx, actor, reservationId, input);
    const payment = await tx.payment.findFirst({ where: { reservationId, kind: "INITIAL", status: { in: ["PAID", "PARTIALLY_REFUNDED"] } } });

    if (payment && (plan.rentalTotal + plan.deliveryTotal) > 0) {
      const impacts: LenderImpact[] = [
        ...plan.lines.filter((l) => l.lenderDeduction > 0).map((l) => ({ lenderId: l.lenderId, amount: l.lenderDeduction, itemId: l.itemId, note: `Annulation ${reservation.reference}` })),
        ...plan.deliveryRefunds.filter((d) => d.lenderDeduction > 0).map((d) => ({ lenderId: d.lenderId, amount: d.lenderDeduction, itemId: null, note: `Livraison annulée ${reservation.reference}` })),
      ];
      await executeRefund(tx, { payment, kind: "CANCELLATION", amount: plan.rentalTotal + plan.deliveryTotal, reason: input.reason, requestedById: actor.userId, impacts, detail: { policy: plan.policyName, lines: plan.lines.map((l) => ({ itemId: l.itemId, percent: l.percent, rentalRefund: l.rentalRefund })) } });
      const commissionBack = sum(plan.lines.map((l) => l.commissionRefund));
      await recordTransaction(tx, { type: "ADJUSTMENT", direction: "INTERNAL", amount: commissionBack, paymentId: payment.id, reservationId, createdById: actor.userId, metadata: { reason: "Commission remboursée (annulation)" } });
    }
    for (const line of plan.lines) {
      const item = items.find((i) => i.id === line.itemId)!;
      if (line.depositRefund > 0 && payment) {
        await executeRefund(tx, { payment, kind: "DEPOSIT_RELEASE", amount: line.depositRefund, reason: `Caution restituée (annulation ${reservation.reference})`, requestedById: actor.userId, impacts: [] });
        await tx.deposit.update({ where: { itemId: item.id }, data: { status: "RELEASED", releasedAmount: line.depositRefund, settledAt: new Date(), reason: "Annulation de la réservation" } });
      }
      await tx.reservationItem.update({ where: { id: item.id }, data: { refundedRental: { increment: line.rentalRefund } } });
      await transitionItems(tx, reservationId, line.rentalRefund > 0 ? "REFUNDED" : "CANCELLED", { actorId: actor.userId, itemIds: [item.id], note: `${input.reason} (remboursement ${line.percent} %)` });
    }

    const remaining = await tx.reservationItem.count({ where: { reservationId, status: { notIn: ["CANCELLED", "REFUNDED"] } } });
    if (remaining === 0) await tx.reservation.update({ where: { id: reservationId }, data: { cancelledAt: new Date(), cancellationReason: input.reason } });
    for (const lenderId of new Set(items.map((i) => i.lenderId))) {
      // Avoir : part remboursée en ligne et solde en espèces qui ne sera plus payé ; le reste reste dû (frais d'annulation).
      const left = await tx.reservationItem.count({ where: { reservationId, lenderId, status: { notIn: ["CANCELLED", "REFUNDED"] } } });
      const pendingCash = reservation.cashSettlements.find((c) => c.lenderId === lenderId && c.status === "PENDING");
      const creditLines: InvoiceLine[] = plan.lines
        .filter((l) => l.lenderId === lenderId)
        .map((l) => {
          const item = items.find((i) => i.id === l.itemId)!;
          return { label: `Annulation : ${item.productName}`, detail: `${item.quantity} x, remboursement ${l.percent} %${item.cashDue > 0 ? ", solde en espèces annulé" : ""}`, quantity: 1, unitPrice: l.rentalRefund + item.cashDue, amount: l.rentalRefund + item.cashDue };
        });
      const deliveryCredit = (plan.deliveryRefunds.find((d) => d.lenderId === lenderId)?.refund ?? 0) + (left === 0 ? pendingCash?.deliveryDue ?? 0 : 0);
      if (deliveryCredit > 0) creditLines.push({ label: "Livraison annulée", quantity: 1, unitPrice: deliveryCredit, amount: deliveryCredit });
      await issueCreditNote(tx, { sourceKey: `CREDIT:CANCEL:${reservationId}:${lenderId}:${plan.lines.filter((l) => l.lenderId === lenderId).map((l) => l.itemId).sort().join(",")}`, reservationId, lenderId, lines: creditLines, reason: `Annulation (${plan.policyName}) : ${input.reason}` });

      await syncCashSettlement(tx, reservationId, lenderId);
      // Livraison annulée dès que toutes les lignes du loueur le sont (même sans frais remboursés en ligne).
      if (left === 0) await tx.delivery.updateMany({ where: { reservationId, lenderId, status: { in: ["PENDING", "PREPARING"] } }, data: { status: "FAILED", notes: "Annulée" } });
    }

    await audit(tx, { userId: actor.userId, lenderId: isLender ? actor.lenderId : null, action: "reservation.cancel", entity: "Reservation", entityId: reservationId, newValue: { reason: input.reason, plan: { client: plan.clientTotal, rental: plan.rentalTotal, deposit: plan.depositTotal } }, meta: actor.meta });
    await notifyUsers(tx, [reservation.clientId], { type: "reservation.cancelled", title: `Annulation ${reservation.reference}`, body: `Remboursement prévu : ${formatFcfa(plan.clientTotal)} (caution comprise).`, link: `/mes-reservations/${reservationId}` });
    for (const lenderId of new Set(items.map((i) => i.lenderId))) {
      await notifyLender(tx, lenderId, { type: "reservation.cancelled", title: `Annulation ${reservation.reference}`, body: input.reason, link: `/loueur/reservations/${reservationId}` }, "ORDER_VIEW");
    }
    return plan;
  });
}

export const adminRefundInput = z.object({
  amount: z.number().int().positive(),
  reason: z.string().trim().min(3).max(500),
  lenderId: z.string().optional(),
  lenderShare: z.number().int().min(0).optional(),
});

/** Remboursement exceptionnel décidé par l'administration (geste commercial, erreur). Montant plafonné par le paiement. */
export async function adminRefund(actor: Actor, paymentId: string, input: z.infer<typeof adminRefundInput>) {
  if (actor.accountType !== "ADMIN" || !can(actor, "ADMIN_REFUNDS")) throw forbidden();
  return transaction(async (tx) => {
    const payment = await tx.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw notFound("Paiement");
    if (!["PAID", "PARTIALLY_REFUNDED"].includes(payment.status)) throw new AppError("CONFLICT", "Ce paiement n'est pas remboursable.");
    const share = input.lenderId ? Math.min(input.lenderShare ?? input.amount, input.amount) : 0;
    const refund = await executeRefund(tx, { payment, kind: "GOODWILL", amount: input.amount, reason: input.reason, requestedById: actor.userId, impacts: input.lenderId && share > 0 ? [{ lenderId: input.lenderId, amount: share, note: input.reason }] : [] });
    if (!refund) throw new AppError("CONFLICT", "Le paiement a déjà été intégralement remboursé.");
    await audit(tx, { userId: actor.userId, action: "refund.create", entity: "Refund", entityId: refund.id, newValue: { amount: refund.amount, reason: input.reason, lenderId: input.lenderId, share }, meta: actor.meta });
    await notifyUsers(tx, [payment.userId], { type: "refund.completed", title: "Remboursement effectué", body: `${formatFcfa(refund.amount)} vous ont été remboursés.`, link: "/mes-remboursements" });
    return refund;
  });
}

export async function getRefundForActor(actor: Actor, refundId: string) {
  const refund = await db.refund.findUnique({ where: { id: refundId }, include: { payment: true, reimbursements: { include: { lender: { select: { companyName: true } } } }, reservation: { select: { reference: true, clientId: true } } } });
  if (!refund) throw notFound("Remboursement");
  if (actor.accountType === "CLIENT" && refund.reservation.clientId !== actor.userId) throw forbidden();
  if (actor.accountType === "ADMIN" && !can(actor, "ADMIN_REFUNDS")) throw forbidden();
  if (actor.accountType === "LENDER") {
    const mine = refund.reimbursements.some((r) => r.lenderId === actor.lenderId);
    if (!mine || !can(actor, "REFUND_VIEW")) throw forbidden();
  }
  return refund;
}

export async function listClientRefunds(userId: string) {
  return db.refund.findMany({ where: { reservation: { clientId: userId } }, include: { reservation: { select: { reference: true, id: true } } }, orderBy: { createdAt: "desc" }, take: 100 });
}

export async function listLenderImpacts(actor: Actor, refundId: string) {
  const refund = await getRefundForActor(actor, refundId);
  return refund.reimbursements.filter((r) => actor.accountType !== "LENDER" || r.lenderId === actor.lenderId);
}

