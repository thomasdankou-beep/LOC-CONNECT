import { randomUUID } from "node:crypto";
import type { Payment, PaymentKind, PaymentMethod } from "@prisma/client";
import { z } from "zod";
import { db, lockPayment, transaction, type Tx } from "@/lib/db";
import { AppError, forbidden, notFound } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { reference } from "@/lib/ids";
import { addMinutes, addDays } from "@/lib/dates";
import { applyBps, sum, formatFcfa } from "@/lib/money";
import { getSettings } from "@/lib/settings";
import { can, type Actor } from "@/lib/auth/actor";
import { assertAvailable } from "../availability";
import { addBalanceEntry, executeRefund, freezeUntil, recordTransaction } from "../finance";
import { notifyUsers } from "../notifications";
import { notifyLendersOfNewReservation, transitionItems } from "../reservations";
import { getProvider, signPayload, type WebhookEventPayload } from "./providers";

export const paymentInput = z.object({
  reservationId: z.string().min(1).optional(),
  extraChargeId: z.string().min(1).optional(),
  method: z.enum(["ORANGE_MONEY", "MTN_MONEY", "MOOV_MONEY", "WAVE", "CARD"]),
  idempotencyKey: z.string().min(8).max(100),
});
export type PaymentInput = z.infer<typeof paymentInput>;

/** Crée l'enregistrement de paiement (en attente) et l'initie auprès du fournisseur. Idempotent par clé. */
export async function createPaymentRecord(
  tx: Tx,
  p: { kind: PaymentKind; reservationId: string; userId: string; amount: number; method: PaymentMethod; idempotencyKey: string; modificationId?: string; extraChargeId?: string },
): Promise<Payment> {
  const existing = await tx.payment.findUnique({ where: { idempotencyKey: p.idempotencyKey } });
  if (existing) {
    if (existing.userId !== p.userId || existing.reservationId !== p.reservationId) throw new AppError("CONFLICT", "Cette clé d'idempotence est déjà utilisée.");
    return existing;
  }
  const provider = getProvider();
  const ref = reference("PAY", 10);
  const charge = await provider.createCharge({ reference: ref, amount: p.amount, currency: "XOF", method: p.method });
  return tx.payment.create({
    data: {
      reference: ref,
      kind: p.kind,
      reservationId: p.reservationId,
      userId: p.userId,
      amount: p.amount,
      method: p.method,
      provider: provider.name,
      providerRef: charge.providerRef,
      idempotencyKey: p.idempotencyKey,
      modificationId: p.modificationId,
      extraChargeId: p.extraChargeId,
    },
  });
}

/**
 * Initie le paiement unique d'une réservation (statut HOLD) ou le règlement d'un complément de caution/dommage.
 * Le montant est celui calculé par le serveur à la création de la réservation : le client ne l'envoie jamais.
 */
export async function initiatePayment(actor: Actor, input: PaymentInput) {
  if (actor.accountType !== "CLIENT") throw forbidden("Seul un client peut payer une réservation.");
  const settings = await getSettings();

  return transaction(async (tx) => {
    const replay = await tx.payment.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (replay) {
      if (replay.userId !== actor.userId) throw new AppError("CONFLICT", "Cette clé d'idempotence est déjà utilisée.");
      return { payment: replay, simulated: getProvider(replay.provider).simulated, replayed: true };
    }

    if (input.extraChargeId) {
      const charge = await tx.extraCharge.findFirst({ where: { id: input.extraChargeId, item: { reservation: { clientId: actor.userId } } }, include: { item: true } });
      if (!charge) throw notFound("Frais complémentaire");
      if (charge.status !== "PENDING") throw new AppError("CONFLICT", "Ces frais ne sont plus à payer.");
      const payment = await createPaymentRecord(tx, { kind: "EXTRA_CHARGE", reservationId: charge.item.reservationId, userId: actor.userId, amount: charge.amount, method: input.method, idempotencyKey: input.idempotencyKey, extraChargeId: charge.id });
      await tx.extraCharge.update({ where: { id: charge.id }, data: { paymentId: payment.id } });
      return { payment, simulated: getProvider(payment.provider).simulated, replayed: false };
    }

    if (!input.reservationId) throw new AppError("VALIDATION_ERROR", "Réservation ou frais à payer requis.");
    const reservation = await tx.reservation.findFirst({ where: { id: input.reservationId, clientId: actor.userId } });
    if (!reservation) throw notFound("Réservation");
    if (!["HOLD", "PENDING_PAYMENT"].includes(reservation.status)) throw new AppError("CONFLICT", "Cette réservation n'est plus à payer.");

    const hold = reservation.holdId ? await tx.hold.findUnique({ where: { id: reservation.holdId } }) : null;
    if (!hold || hold.status !== "ACTIVE") throw new AppError("HOLD_EXPIRED", "Le blocage de stock a expiré. Relancez le paiement depuis votre panier.");

    const pending = await tx.payment.findFirst({ where: { reservationId: reservation.id, kind: "INITIAL", status: "PENDING" } });
    if (pending) return { payment: pending, simulated: getProvider(pending.provider).simulated, replayed: true };

    const payment = await createPaymentRecord(tx, { kind: "INITIAL", reservationId: reservation.id, userId: actor.userId, amount: reservation.total, method: input.method, idempotencyKey: input.idempotencyKey });

    // Prolongation unique du blocage pendant que le paiement est en cours.
    const graceEnd = addMinutes(new Date(), settings["hold.payment_grace_minutes"]);
    if (hold.expiresAt < graceEnd) await tx.hold.update({ where: { id: hold.id }, data: { expiresAt: graceEnd } });
    await transitionItems(tx, reservation.id, "PENDING_PAYMENT", { actorId: actor.userId, onlyFrom: ["HOLD"], note: "Paiement initié" });
    await audit(tx, { userId: actor.userId, action: "payment.initiate", entity: "Payment", entityId: payment.id, newValue: { amount: payment.amount, method: payment.method, provider: payment.provider }, meta: actor.meta });
    return { payment, simulated: getProvider(payment.provider).simulated, replayed: false };
  });
}

/**
 * Point d'entrée des webhooks de paiement. Vérifie la signature, enregistre l'événement (un événement n'est traité qu'une fois)
 * puis applique le résultat dans une transaction qui verrouille le paiement.
 */
export async function handleWebhook(providerName: string, rawBody: string, signature: string | null) {
  const provider = getProvider(providerName);
  if (!provider.verifySignature(rawBody, signature)) {
    await db.webhookEvent.create({ data: { provider: provider.name, eventId: `invalid-${randomUUID()}`, type: "invalid", payload: { length: rawBody.length }, signatureValid: false, error: "Signature invalide" } });
    throw new AppError("UNAUTHENTICATED", "Signature du webhook invalide.");
  }
  let event: WebhookEventPayload;
  try {
    event = JSON.parse(rawBody) as WebhookEventPayload;
  } catch {
    throw new AppError("BAD_REQUEST", "Corps de webhook invalide.");
  }
  if (!event?.id || !event.type || !event.data?.reference) throw new AppError("BAD_REQUEST", "Événement de paiement incomplet.");

  try {
    await db.webhookEvent.create({ data: { provider: provider.name, eventId: event.id, type: event.type, payload: JSON.parse(rawBody), signatureValid: true } });
  } catch (e) {
    const known = await db.webhookEvent.findUnique({ where: { provider_eventId: { provider: provider.name, eventId: event.id } } });
    if (known) return { duplicate: true, processed: Boolean(known.processedAt) };
    throw e;
  }

  try {
    const result = await transaction(async (tx) => {
      const payment = await tx.payment.findUnique({ where: { reference: event.data.reference } });
      if (!payment) throw new AppError("NOT_FOUND", "Paiement introuvable.");
      await lockPayment(tx, payment.id);
      const locked = await tx.payment.findUniqueOrThrow({ where: { id: payment.id } });
      if (event.data.amount !== locked.amount) throw new AppError("PAYMENT_AMOUNT_MISMATCH", "Le montant du webhook ne correspond pas au paiement.");
      if (event.type === "payment.succeeded") return applySuccess(tx, locked);
      if (event.type === "payment.failed") return applyFailure(tx, locked, event.data.failureReason ?? "Paiement refusé");
      throw new AppError("BAD_REQUEST", "Type d'événement non géré.");
    });
    await db.webhookEvent.update({ where: { provider_eventId: { provider: provider.name, eventId: event.id } }, data: { processedAt: new Date() } });
    return { duplicate: false, processed: true, result };
  } catch (e) {
    await db.webhookEvent.update({ where: { provider_eventId: { provider: provider.name, eventId: event.id } }, data: { error: e instanceof Error ? e.message : "Erreur" } }).catch(() => undefined);
    throw e;
  }
}

async function applyFailure(tx: Tx, payment: Payment, reason: string) {
  if (payment.status !== "PENDING") return { status: payment.status, noop: true };
  await tx.payment.update({ where: { id: payment.id }, data: { status: "FAILED", failureReason: reason } });
  if (payment.kind === "INITIAL") {
    const reservation = await tx.reservation.findUniqueOrThrow({ where: { id: payment.reservationId } });
    const hold = reservation.holdId ? await tx.hold.findUnique({ where: { id: reservation.holdId } }) : null;
    if (hold?.status === "ACTIVE" && reservation.status === "PENDING_PAYMENT") {
      await transitionItems(tx, reservation.id, "HOLD", { onlyFrom: ["PENDING_PAYMENT"], note: "Paiement échoué" });
    }
  }
  await notifyUsers(tx, [payment.userId], { type: "payment.failed", title: "Paiement échoué", body: `Le paiement ${payment.reference} n'a pas abouti : ${reason}.`, link: `/mes-paiements` });
  return { status: "FAILED" as const };
}

async function applySuccess(tx: Tx, payment: Payment) {
  if (payment.status === "PAID" || payment.status === "REFUNDED" || payment.status === "PARTIALLY_REFUNDED") return { status: payment.status, noop: true };
  if (payment.kind === "MODIFICATION") {
    const { onModificationPaid } = await import("../modifications");
    return onModificationPaid(tx, payment);
  }
  if (payment.kind === "EXTRA_CHARGE") {
    const { onExtraChargePaid } = await import("../returns");
    return onExtraChargePaid(tx, payment);
  }
  return settleInitialPayment(tx, payment);
}

async function settleInitialPayment(tx: Tx, payment: Payment) {
  const settings = await getSettings(tx);
  const now = new Date();
  const reservation = await tx.reservation.findUniqueOrThrow({ where: { id: payment.reservationId }, include: { items: { include: { product: { include: { lender: true } } } } } });
  const hold = reservation.holdId ? await tx.hold.findUnique({ where: { id: reservation.holdId } }) : null;

  let valid = ["HOLD", "PENDING_PAYMENT"].includes(reservation.status) && hold?.status === "ACTIVE";
  if (valid && hold && hold.expiresAt <= now) {
    // Le blocage est arrivé à échéance sans nettoyage : on revérifie que le stock est toujours libre.
    try {
      await assertAvailable(tx, reservation.items.map((i) => ({ productId: i.productId, quantity: i.quantity, start: i.startDate, end: i.endDate })));
    } catch {
      valid = false;
    }
  }

  await tx.payment.update({ where: { id: payment.id }, data: { status: "PAID", paidAt: now } });
  await recordTransaction(tx, { type: "PAYMENT_RECEIVED", direction: "IN", amount: payment.amount, paymentId: payment.id, reservationId: reservation.id, metadata: { method: payment.method, provider: payment.provider } });

  if (!valid) {
    await executeRefund(tx, { payment: { id: payment.id, amount: payment.amount, reservationId: reservation.id }, kind: "CANCELLATION", amount: payment.amount, reason: "Paiement reçu après expiration du blocage de stock", impacts: [] });
    if (!["CANCELLED", "REFUNDED"].includes(reservation.status)) {
      await tx.reservationItem.updateMany({ where: { reservationId: reservation.id }, data: { status: "CANCELLED", cancelledAt: now } });
      await tx.reservation.update({ where: { id: reservation.id }, data: { status: "CANCELLED", cancelledAt: now, cancellationReason: "Paiement tardif remboursé" } });
    }
    await notifyUsers(tx, [payment.userId], { type: "payment.refunded_late", title: "Paiement remboursé", body: `Le blocage de stock avait expiré : votre paiement ${payment.reference} a été intégralement remboursé.`, link: "/mes-paiements" });
    return { status: "REFUNDED_LATE" as const };
  }

  await tx.hold.update({ where: { id: hold!.id }, data: { status: "CONVERTED", convertedReservationId: reservation.id } });

  if (reservation.status === "HOLD") await transitionItems(tx, reservation.id, "PENDING_PAYMENT", { onlyFrom: ["HOLD"] });
  await transitionItems(tx, reservation.id, "PAID", { onlyFrom: ["PENDING_PAYMENT"], note: "Paiement confirmé" });
  if (!settings["reservation.lender_must_accept"]) {
    await transitionItems(tx, reservation.id, "CONFIRMED", { onlyFrom: ["PAID"], note: "Confirmation automatique" });
  }

  const deliveries = await tx.delivery.findMany({ where: { reservationId: reservation.id } });
  const lenderIds = [...new Set(reservation.items.map((i) => i.lenderId))];
  for (const lenderId of lenderIds) {
    const mine = reservation.items.filter((i) => i.lenderId === lenderId);
    const rate = mine[0].commissionRateBps;
    const deliveryFee = deliveries.find((d) => d.lenderId === lenderId)?.fee ?? 0;
    const itemCommission = sum(mine.map((i) => i.commission));
    const deliveryCommission = settings["commission.on_delivery"] ? applyBps(deliveryFee, rate) : 0;
    const rental = sum(mine.map((i) => i.subtotal));
    const commission = itemCommission + deliveryCommission;
    const deposit = sum(mine.map((i) => i.depositAmount));

    await tx.paymentAllocation.create({ data: { paymentId: payment.id, reservationId: reservation.id, lenderId, rentalAmount: rental, deliveryAmount: deliveryFee, commissionAmount: commission, netAmount: rental + deliveryFee - commission, depositAmount: deposit } });
    await recordTransaction(tx, { type: "COMMISSION", direction: "INTERNAL", amount: commission, paymentId: payment.id, reservationId: reservation.id, lenderId });

    for (const item of mine) {
      await addBalanceEntry(tx, { lenderId, kind: "SALE", amount: item.subtotal - item.commission, availableAt: freezeUntil(item.endDate, settings), reservationId: reservation.id, itemId: item.id });
      await tx.deposit.update({ where: { itemId: item.id }, data: { status: "HELD", heldAt: now, paymentId: payment.id, releaseDueDate: addDays(item.endDate, settings["deposit.release_deadline_days"]) } });
      await recordTransaction(tx, { type: "DEPOSIT_HELD", direction: "INTERNAL", amount: item.depositAmount, paymentId: payment.id, reservationId: reservation.id, itemId: item.id, lenderId });
    }
    if (deliveryFee > 0) {
      const lastEnd = new Date(Math.max(...mine.map((i) => i.endDate.getTime())));
      await addBalanceEntry(tx, { lenderId, kind: "DELIVERY_FEE", amount: deliveryFee - deliveryCommission, availableAt: freezeUntil(lastEnd, settings), reservationId: reservation.id, note: "Frais de livraison" });
    }
  }

  // Les lignes du panier correspondant au HOLD converti sont retirées.
  const holdItems = await tx.holdItem.findMany({ where: { holdId: hold!.id } });
  for (const h of holdItems) {
    await tx.cartItem.deleteMany({ where: { cart: { userId: payment.userId }, productId: h.productId, startDate: h.startDate, endDate: h.endDate } });
  }

  await notifyUsers(tx, [payment.userId], { type: "payment.succeeded", title: `Paiement confirmé, réservation ${reservation.reference}`, body: `Votre paiement de ${formatFcfa(payment.amount)} a bien été reçu${payment.provider === "simulated" ? " (paiement simulé)" : ""}.`, link: `/mes-reservations/${reservation.id}` });
  await notifyLendersOfNewReservation(tx, reservation.id);
  await audit(tx, { userId: payment.userId, action: "payment.confirmed", entity: "Payment", entityId: payment.id, newValue: { amount: payment.amount, reservation: reservation.reference } });
  return { status: "PAID" as const };
}

/**
 * Démonstration : déclenche un webhook signé comme le ferait le fournisseur. Passe par le même chemin de code que la production
 * (signature, idempotence, transaction). Refusé dès qu'un fournisseur réel est configuré.
 */
export async function simulatePayment(actor: Actor, paymentId: string, outcome: "success" | "failure") {
  const payment = await db.payment.findUnique({ where: { id: paymentId } });
  if (!payment) throw notFound("Paiement");
  if (actor.accountType === "CLIENT" ? payment.userId !== actor.userId : !can(actor, "ADMIN_PAYMENTS")) throw forbidden();
  const provider = getProvider(payment.provider);
  if (!provider.simulated) throw new AppError("FORBIDDEN", "La simulation n'est disponible qu'avec le fournisseur de démonstration.");
  const event: WebhookEventPayload = {
    id: `evt_${randomUUID()}`,
    type: outcome === "success" ? "payment.succeeded" : "payment.failed",
    data: { reference: payment.reference, providerRef: payment.providerRef ?? undefined, amount: payment.amount, currency: payment.currency, failureReason: outcome === "failure" ? "Échec simulé par l'utilisateur" : undefined },
  };
  const raw = JSON.stringify(event);
  return handleWebhook(provider.name, raw, signPayload(raw));
}

export async function getPaymentForActor(actor: Actor, paymentId: string) {
  const payment = await db.payment.findUnique({ where: { id: paymentId }, include: { reservation: { select: { reference: true, id: true } }, refunds: true } });
  if (!payment) throw notFound("Paiement");
  if (actor.accountType === "CLIENT" && payment.userId !== actor.userId) throw forbidden();
  if (actor.accountType === "ADMIN" && !can(actor, "ADMIN_PAYMENTS")) throw forbidden();
  if (actor.accountType === "LENDER") {
    const mine = actor.lenderId ? await db.paymentAllocation.count({ where: { paymentId, lenderId: actor.lenderId } }) : 0;
    if (!mine || !can(actor, "FINANCE_VIEW")) throw forbidden();
  }
  return payment;
}

export async function lenderSplits(actor: Actor, paymentId: string) {
  await getPaymentForActor(actor, paymentId);
  return db.paymentAllocation.findMany({
    where: { paymentId, ...(actor.accountType === "LENDER" ? { lenderId: actor.lenderId! } : {}) },
    include: { lender: { select: { id: true, companyName: true } } },
  });
}

export async function listClientPayments(userId: string, page = 1, pageSize = 15) {
  const where = { userId };
  const [total, rows] = await Promise.all([
    db.payment.count({ where }),
    db.payment.findMany({ where, include: { reservation: { select: { reference: true, id: true } }, refunds: { select: { amount: true, status: true } } }, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
  ]);
  return { rows, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}
