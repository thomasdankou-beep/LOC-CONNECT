import { z } from "zod";
import type { LenderPaymentMode, Payment, Prisma, ReservationStatus } from "@prisma/client";
import { db, lockReservation, transaction, type Tx } from "@/lib/db";
import { AppError, forbidden, notFound } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { addHours, daysBetween, hoursUntil, parseDate } from "@/lib/dates";
import { applyBps, sum, formatFcfa } from "@/lib/money";
import { getSettings, type Settings } from "@/lib/settings";
import { can, type Actor } from "@/lib/auth/actor";
import { assertAvailable, validateRentalPeriod } from "./availability";
import { addBalanceEntry, executeRefund, freezeUntil, recordTransaction } from "./finance";
import { createPaymentRecord } from "./payments";
import { notifyAdmins, notifyLender, notifyUsers } from "./notifications";
import { snapshotOf, transitionItems } from "./reservations";
import { effectivePaymentMode, onlineRentalFor } from "./pricing";
import { assertCashNotCollected, cashTotalFor, syncCashSettlement } from "./cash";

const MODIFIABLE: ReservationStatus[] = ["PAID", "CONFIRMED", "READY"];
const OPEN: ("PENDING_VALIDATION" | "ACCEPTED" | "PENDING_PAYMENT" | "PAID" | "REQUESTED")[] = ["REQUESTED", "PENDING_VALIDATION", "ACCEPTED", "PENDING_PAYMENT", "PAID"];

export const modificationInput = z.object({
  reason: z.string().trim().max(500).optional(),
  lines: z
    .array(
      z.object({
        action: z.enum(["ADD", "UPDATE", "REMOVE"]),
        itemId: z.string().optional(),
        productId: z.string().optional(),
        quantity: z.number().int().positive().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }),
    )
    .min(1)
    .max(20),
});
export type ModificationInput = z.infer<typeof modificationInput>;

type PlannedLine = {
  action: "ADD" | "UPDATE" | "REMOVE";
  itemId?: string;
  productId: string;
  productName: string;
  quantityBefore: number;
  quantityAfter: number;
  startBefore?: Date;
  endBefore?: Date;
  startAfter?: Date;
  endAfter?: Date;
  unitPrice: number;
  commissionRateBps: number;
  depositUnit: number;
  refundPrice: number;
  allowsExtraBilling: boolean;
  subtotalBefore: number;
  subtotalAfter: number;
  commissionBefore: number;
  commissionAfter: number;
  depositBefore: number;
  depositAfter: number;
  /** Mode de paiement du loueur (figé) et part de la location réglée en espèces avant et après. */
  paymentMode: LenderPaymentMode;
  cashBefore: number;
  cashAfter: number;
};

export type ModificationPlan = {
  lenderId: string;
  lines: PlannedLine[];
  amountBefore: number;
  amountAfter: number;
  depositBefore: number;
  depositAfter: number;
  commissionBefore: number;
  commissionAfter: number;
  cashBefore: number;
  cashAfter: number;
  /** Complément à payer en ligne : augmentation de la part en ligne de la location et de la caution. */
  differenceToPay: number;
  /** Remboursement : l'intégralité de la différence en cas de diminution (décision validée). */
  refundToIssue: number;
};

/** Calcul complet d'une modification, côté serveur : prix, caution, commission, complément, remboursement. */
export async function planModification(tx: Tx | typeof db, settings: Settings, clientId: string, reservationId: string, input: ModificationInput, now = new Date()): Promise<ModificationPlan> {
  const reservation = await tx.reservation.findFirst({ where: { id: reservationId, clientId }, include: { items: { include: { product: { include: { lender: true } } } } } });
  if (!reservation) throw notFound("Réservation");

  const deadlineHours = settings["modification.free_deadline_hours"];
  const lines: PlannedLine[] = [];
  let lenderId: string | null = null;
  const touched = new Set<string>();
  const minCash = settings["cash.min_deposit"];
  // Un loueur déjà présent garde le mode figé sur ses lignes ; sinon son mode actuel s'applique.
  const modeFor = (lender: { id: string; paymentMode: LenderPaymentMode; cashModeAllowed: boolean }): LenderPaymentMode =>
    reservation.items.find((i) => i.lenderId === lender.id)?.paymentMode ?? effectivePaymentMode(lender, settings);
  const cashFor = (subtotal: number, commission: number, mode: LenderPaymentMode) => subtotal - onlineRentalFor(subtotal, commission, mode, minCash);

  for (const l of input.lines) {
    if (l.action === "ADD") {
      if (!l.productId || !l.quantity || !l.startDate || !l.endDate) throw new AppError("VALIDATION_ERROR", "Produit, quantité et dates sont requis pour ajouter un article.");
      const product = await tx.product.findFirst({ where: { id: l.productId, status: "PUBLISHED", deletedAt: null, lender: { status: "APPROVED" } }, include: { lender: true } });
      if (!product) throw notFound("Produit");
      const start = parseDate(l.startDate);
      const end = parseDate(l.endDate);
      validateRentalPeriod(settings, product, { quantity: l.quantity, start, end }, now);
      if (hoursUntil(start, now) < deadlineHours) throw new AppError("MODIFICATION_DEADLINE_EXCEEDED", `L'ajout doit se faire au moins ${deadlineHours} h avant le début de la location.`);
      const rate = product.lender.commissionRateBps ?? settings["commission.rate_bps"];
      const subtotal = product.unitPrice * l.quantity * daysBetween(start, end);
      lenderId = lenderId ?? product.lenderId;
      if (lenderId !== product.lenderId) throw new AppError("MODIFICATION_NOT_ALLOWED", "Une demande de modification ne peut concerner qu'un seul loueur.");
      const mode = modeFor(product.lender);
      lines.push({ action: "ADD", productId: product.id, productName: product.name, quantityBefore: 0, quantityAfter: l.quantity, startAfter: start, endAfter: end, unitPrice: product.unitPrice, commissionRateBps: rate, depositUnit: product.depositAmount, refundPrice: product.refundPrice, allowsExtraBilling: product.allowsExtraBilling, subtotalBefore: 0, subtotalAfter: subtotal, commissionBefore: 0, commissionAfter: applyBps(subtotal, rate), depositBefore: 0, depositAfter: product.depositAmount * l.quantity, paymentMode: mode, cashBefore: 0, cashAfter: cashFor(subtotal, applyBps(subtotal, rate), mode) });
      continue;
    }

    const item = reservation.items.find((i) => i.id === l.itemId);
    if (!item) throw new AppError("VALIDATION_ERROR", "Ligne de réservation introuvable.");
    if (touched.has(item.id)) throw new AppError("VALIDATION_ERROR", "Une ligne ne peut être modifiée qu'une fois par demande.");
    touched.add(item.id);
    if (!MODIFIABLE.includes(item.status)) throw new AppError("MODIFICATION_NOT_ALLOWED", `${item.productName} ne peut plus être modifié (statut ${item.status}).`);
    lenderId = lenderId ?? item.lenderId;
    if (lenderId !== item.lenderId) throw new AppError("MODIFICATION_NOT_ALLOWED", "Une demande de modification ne peut concerner qu'un seul loueur.");
    if (hoursUntil(item.startDate, now) < deadlineHours) {
      throw new AppError("MODIFICATION_DEADLINE_EXCEEDED", `Les modifications ne sont plus possibles à moins de ${deadlineHours} h du début de la location.`);
    }
    const depositUnit = item.quantity > 0 ? item.depositAmount / item.quantity : 0;

    if (l.action === "REMOVE") {
      lines.push({ action: "REMOVE", itemId: item.id, productId: item.productId, productName: item.productName, quantityBefore: item.quantity, quantityAfter: 0, startBefore: item.startDate, endBefore: item.endDate, unitPrice: item.unitPrice, commissionRateBps: item.commissionRateBps, depositUnit, refundPrice: item.refundPrice, allowsExtraBilling: item.allowsExtraBilling, subtotalBefore: item.subtotal, subtotalAfter: 0, commissionBefore: item.commission, commissionAfter: 0, depositBefore: item.depositAmount, depositAfter: 0, paymentMode: item.paymentMode, cashBefore: item.cashDue, cashAfter: 0 });
      continue;
    }

    const quantity = l.quantity ?? item.quantity;
    const start = l.startDate ? parseDate(l.startDate) : item.startDate;
    const end = l.endDate ? parseDate(l.endDate) : item.endDate;
    if (quantity === item.quantity && start.getTime() === item.startDate.getTime() && end.getTime() === item.endDate.getTime()) {
      throw new AppError("VALIDATION_ERROR", `Aucun changement demandé pour ${item.productName}.`);
    }
    validateRentalPeriod(settings, item.product, { quantity, start, end }, now);
    if (hoursUntil(start, now) < deadlineHours) throw new AppError("MODIFICATION_DEADLINE_EXCEEDED", `La nouvelle date de début doit être au moins ${deadlineHours} h après maintenant.`);
    const subtotal = item.unitPrice * quantity * daysBetween(start, end);
    const commissionAfter = applyBps(subtotal, item.commissionRateBps);
    lines.push({ action: "UPDATE", itemId: item.id, productId: item.productId, productName: item.productName, quantityBefore: item.quantity, quantityAfter: quantity, startBefore: item.startDate, endBefore: item.endDate, startAfter: start, endAfter: end, unitPrice: item.unitPrice, commissionRateBps: item.commissionRateBps, depositUnit, refundPrice: item.refundPrice, allowsExtraBilling: item.allowsExtraBilling, subtotalBefore: item.subtotal, subtotalAfter: subtotal, commissionBefore: item.commission, commissionAfter, depositBefore: item.depositAmount, depositAfter: Math.round(depositUnit * quantity), paymentMode: item.paymentMode, cashBefore: item.cashDue, cashAfter: cashFor(subtotal, commissionAfter, item.paymentMode) });
  }

  const remaining = reservation.items.filter((i) => !["CANCELLED", "REFUNDED"].includes(i.status) && !input.lines.some((l) => l.action === "REMOVE" && l.itemId === i.id));
  if (remaining.length === 0 && !lines.some((l) => l.action === "ADD")) throw new AppError("MODIFICATION_NOT_ALLOWED", "Pour supprimer toutes les lignes, annulez la réservation.");

  await assertCashNotCollected(tx, reservationId, [lenderId!], "la modification");

  const amountBefore = sum(lines.map((l) => l.subtotalBefore));
  const amountAfter = sum(lines.map((l) => l.subtotalAfter));
  const depositBefore = sum(lines.map((l) => l.depositBefore));
  const depositAfter = sum(lines.map((l) => l.depositAfter));
  const cashBefore = sum(lines.map((l) => l.cashBefore));
  const cashAfter = sum(lines.map((l) => l.cashAfter));
  // Le complément ou le remboursement ne porte que sur ce qui est payé en ligne ; la part en espèces suit au moment de la remise.
  const net = amountAfter - cashAfter - (amountBefore - cashBefore) + (depositAfter - depositBefore);
  return {
    lenderId: lenderId!,
    lines,
    amountBefore,
    amountAfter,
    depositBefore,
    depositAfter,
    commissionBefore: sum(lines.map((l) => l.commissionBefore)),
    commissionAfter: sum(lines.map((l) => l.commissionAfter)),
    cashBefore,
    cashAfter,
    differenceToPay: Math.max(0, net),
    refundToIssue: Math.max(0, -net),
  };
}

async function checkAvailability(tx: Tx, plan: ModificationPlan) {
  const excluded = plan.lines.filter((l) => l.itemId).map((l) => l.itemId!);
  await assertAvailable(
    tx,
    plan.lines.filter((l) => l.action !== "REMOVE").map((l) => ({ productId: l.productId, quantity: l.quantityAfter, start: l.startAfter!, end: l.endAfter! })),
    { excludeItemIds: excluded },
  );
}

/** Crée une demande de modification : rien n'est appliqué tant que le loueur n'a pas validé (et que le complément n'est pas payé). */
export async function requestModification(actor: Actor, reservationId: string, input: ModificationInput) {
  if (actor.accountType !== "CLIENT") throw forbidden("Seul le client peut demander une modification.");
  const settings = await getSettings();
  return transaction(async (tx) => {
    await lockReservation(tx, reservationId);
    const open = await tx.modificationRequest.count({ where: { reservationId, status: { in: OPEN } } });
    if (open > 0) throw new AppError("CONFLICT", "Une demande de modification est déjà en cours pour cette réservation.");
    const plan = await planModification(tx, settings, actor.userId, reservationId, input);
    await checkAvailability(tx, plan);

    const now = new Date();
    const earliestStart = Math.min(...plan.lines.map((l) => (l.startBefore ?? l.startAfter!).getTime()));
    const expiresAt = new Date(Math.min(addHours(now, settings["modification.request_validity_hours"]).getTime(), earliestStart - settings["modification.free_deadline_hours"] * 3_600_000));
    const request = await tx.modificationRequest.create({
      data: {
        reservationId,
        clientId: actor.userId,
        lenderId: plan.lenderId,
        status: "PENDING_VALIDATION",
        reason: input.reason,
        amountBefore: plan.amountBefore,
        amountAfter: plan.amountAfter,
        differenceToPay: plan.differenceToPay,
        refundToIssue: plan.refundToIssue,
        depositBefore: plan.depositBefore,
        depositAfter: plan.depositAfter,
        commissionBefore: plan.commissionBefore,
        commissionAfter: plan.commissionAfter,
        cashBefore: plan.cashBefore,
        cashAfter: plan.cashAfter,
        requestedById: actor.userId,
        respondBy: addHours(now, settings["modification.lender_response_hours"]),
        expiresAt,
        lines: {
          create: plan.lines.map((l) => ({
            itemId: l.itemId,
            productId: l.productId,
            action: l.action,
            quantityBefore: l.quantityBefore,
            quantityRequested: l.quantityAfter,
            startBefore: l.startBefore,
            endBefore: l.endBefore,
            startAfter: l.startAfter,
            endAfter: l.endAfter,
            unitPriceBefore: l.unitPrice,
            unitPriceAfter: l.unitPrice,
            subtotalBefore: l.subtotalBefore,
            subtotalAfter: l.subtotalAfter,
            paymentMode: l.paymentMode,
            cashAfter: l.cashAfter,
          })),
        },
      },
      include: { lines: true },
    });
    const reservation = await tx.reservation.findUniqueOrThrow({ where: { id: reservationId } });
    await audit(tx, { userId: actor.userId, action: "modification.request", entity: "ModificationRequest", entityId: request.id, newValue: { toPay: plan.differenceToPay, refund: plan.refundToIssue }, meta: actor.meta });
    await notifyLender(tx, plan.lenderId, { type: "modification.requested", title: `Demande de modification ${reservation.reference}`, body: `Réponse attendue sous ${settings["modification.lender_response_hours"]} h.`, link: `/loueur/reservations/${reservationId}` }, "MODIFICATION_DECIDE");
    return request;
  });
}

/** Aperçu sans création : le client voit complément, remboursement, caution et commission avant d'envoyer. */
export async function previewModification(actor: Actor, reservationId: string, input: ModificationInput) {
  if (actor.accountType !== "CLIENT") throw forbidden();
  const settings = await getSettings();
  const plan = await planModification(db, settings, actor.userId, reservationId, input);
  let availability: { ok: boolean; message?: string } = { ok: true };
  try {
    await transaction(async (tx) => {
      await checkAvailability(tx, plan);
    });
  } catch (e) {
    if (e instanceof AppError && e.code === "STOCK_INSUFFICIENT") availability = { ok: false, message: e.message };
    else throw e;
  }
  return { ...plan, lines: plan.lines.map((l) => ({ ...l, startBefore: l.startBefore?.toISOString().slice(0, 10), endBefore: l.endBefore?.toISOString().slice(0, 10), startAfter: l.startAfter?.toISOString().slice(0, 10), endAfter: l.endAfter?.toISOString().slice(0, 10) })), availability };
}

async function loadForDecision(actor: Actor, reservationId: string, modificationId: string) {
  const mod = await db.modificationRequest.findFirst({ where: { id: modificationId, reservationId }, include: { lines: true, reservation: true } });
  if (!mod) throw notFound("Demande de modification");
  if (actor.accountType === "ADMIN") {
    if (!can(actor, "ADMIN_MODIFICATIONS")) throw forbidden();
  } else if (actor.accountType === "LENDER") {
    if (mod.lenderId !== actor.lenderId || !can(actor, "MODIFICATION_DECIDE")) throw forbidden();
  } else throw forbidden();
  return mod;
}

export async function getModificationForActor(actor: Actor, reservationId: string, modificationId: string) {
  const mod = await db.modificationRequest.findFirst({ where: { id: modificationId, reservationId }, include: { lines: true, reservation: { select: { reference: true, clientId: true } } } });
  if (!mod) throw notFound("Demande de modification");
  if (actor.accountType === "CLIENT" && mod.clientId !== actor.userId) throw forbidden();
  if (actor.accountType === "LENDER" && (mod.lenderId !== actor.lenderId || !can(actor, "ORDER_VIEW"))) throw forbidden();
  if (actor.accountType === "ADMIN" && !can(actor, "ADMIN_RESERVATIONS")) throw forbidden();
  return mod;
}

export async function listModifications(actor: Actor, reservationId: string) {
  const base = await db.reservation.findUnique({ where: { id: reservationId }, select: { clientId: true } });
  if (!base) throw notFound("Réservation");
  if (actor.accountType === "CLIENT" && base.clientId !== actor.userId) throw forbidden();
  if (actor.accountType === "LENDER" && !actor.lenderId) throw forbidden();
  return db.modificationRequest.findMany({
    where: { reservationId, ...(actor.accountType === "LENDER" ? { lenderId: actor.lenderId! } : {}) },
    include: { lines: true },
    orderBy: { requestedAt: "desc" },
  });
}

/** Acceptation par le loueur (ou l'administration en escalade). Sans complément à payer, la modification est appliquée aussitôt. */
export async function approveModification(actor: Actor, reservationId: string, modificationId: string) {
  const pre = await loadForDecision(actor, reservationId, modificationId);
  return transaction(async (tx) => {
    await lockReservation(tx, reservationId);
    const mod = await tx.modificationRequest.findUniqueOrThrow({ where: { id: modificationId }, include: { lines: true } });
    if (mod.status !== "PENDING_VALIDATION") throw new AppError("CONFLICT", "Cette demande n'est plus en attente de validation.");
    if (mod.expiresAt < new Date()) throw new AppError("CONFLICT", "Cette demande a expiré.");
    await tx.modificationRequest.update({ where: { id: mod.id }, data: { status: "ACCEPTED", validatedById: actor.userId, validatedAt: new Date() } });
    await audit(tx, { userId: actor.userId, lenderId: actor.lenderId, action: "modification.approve", entity: "ModificationRequest", entityId: mod.id, meta: actor.meta });

    if (mod.differenceToPay > 0) {
      await tx.modificationRequest.update({ where: { id: mod.id }, data: { status: "PENDING_PAYMENT" } });
      await notifyUsers(tx, [mod.clientId], { type: "modification.accepted", title: `Modification acceptée : ${pre.reservation.reference}`, body: `Réglez le complément de ${formatFcfa(mod.differenceToPay)} pour l'appliquer.`, link: `/mes-reservations/${reservationId}` });
      return tx.modificationRequest.findUniqueOrThrow({ where: { id: mod.id }, include: { lines: true } });
    }
    const applied = await applyModificationTx(tx, mod.id, actor.userId);
    return applied;
  });
}

export async function rejectModification(actor: Actor, reservationId: string, modificationId: string, reason: string) {
  const pre = await loadForDecision(actor, reservationId, modificationId);
  return transaction(async (tx) => {
    const mod = await tx.modificationRequest.findUniqueOrThrow({ where: { id: modificationId } });
    if (mod.status !== "PENDING_VALIDATION") throw new AppError("CONFLICT", "Cette demande n'est plus en attente de validation.");
    const updated = await tx.modificationRequest.update({ where: { id: mod.id }, data: { status: "REJECTED", rejectionReason: reason, validatedById: actor.userId, validatedAt: new Date() } });
    await audit(tx, { userId: actor.userId, lenderId: actor.lenderId, action: "modification.reject", entity: "ModificationRequest", entityId: mod.id, newValue: { reason }, meta: actor.meta });
    await notifyUsers(tx, [mod.clientId], { type: "modification.rejected", title: `Modification refusée : ${pre.reservation.reference}`, body: reason, link: `/mes-reservations/${reservationId}` });
    return updated;
  });
}

/** Escalade : l'administration relance le loueur avec un délai supplémentaire (sinon elle tranche elle-même via approve ou reject). */
export async function relaunchModification(actor: Actor, reservationId: string, modificationId: string, extraHours = 2) {
  if (actor.accountType !== "ADMIN" || !can(actor, "ADMIN_MODIFICATIONS")) throw forbidden();
  const mod = await db.modificationRequest.findFirst({ where: { id: modificationId, reservationId } });
  if (!mod) throw notFound("Demande de modification");
  if (mod.status !== "PENDING_VALIDATION") throw new AppError("CONFLICT", "Cette demande n'est plus en attente de validation.");
  return transaction(async (tx) => {
    const updated = await tx.modificationRequest.update({ where: { id: mod.id }, data: { respondBy: addHours(new Date(), extraHours), escalatedAt: null, escalationNote: `Relancée par l'administration (+${extraHours} h)` } });
    await audit(tx, { userId: actor.userId, action: "modification.relaunch", entity: "ModificationRequest", entityId: mod.id, newValue: { extraHours }, meta: actor.meta });
    await notifyLender(tx, mod.lenderId, { type: "modification.relaunched", title: "Demande de modification relancée", body: `L'administration vous accorde ${extraHours} h supplémentaires pour répondre.`, link: `/loueur/reservations/${reservationId}` }, "MODIFICATION_DECIDE");
    return updated;
  });
}

/** Le client règle le complément (paiement distinct du paiement initial, confirmé par webhook). */
export async function payModification(actor: Actor, reservationId: string, modificationId: string, method: Payment["method"], idempotencyKey: string) {
  if (actor.accountType !== "CLIENT") throw forbidden();
  return transaction(async (tx) => {
    const mod = await tx.modificationRequest.findFirst({ where: { id: modificationId, reservationId, clientId: actor.userId } });
    if (!mod) throw notFound("Demande de modification");
    if (mod.status === "PAID" || mod.status === "APPLIED") throw new AppError("MODIFICATION_ALREADY_APPLIED", "Cette modification a déjà été réglée.");
    if (mod.status !== "PENDING_PAYMENT") throw new AppError("PAYMENT_REQUIRED", "Le complément ne peut être réglé qu'après acceptation par le loueur.");
    if (mod.expiresAt < new Date()) throw new AppError("CONFLICT", "Cette demande a expiré.");
    const payment = await createPaymentRecord(tx, { kind: "MODIFICATION", reservationId, userId: actor.userId, amount: mod.differenceToPay, method, idempotencyKey, modificationId: mod.id });
    await tx.modificationRequest.update({ where: { id: mod.id }, data: { paymentId: payment.id } });
    return payment;
  });
}

export async function cancelModification(actor: Actor, reservationId: string, modificationId: string) {
  if (actor.accountType !== "CLIENT") throw forbidden();
  return transaction(async (tx) => {
    const mod = await tx.modificationRequest.findFirst({ where: { id: modificationId, reservationId, clientId: actor.userId } });
    if (!mod) throw notFound("Demande de modification");
    if (mod.status === "APPLIED") throw new AppError("MODIFICATION_ALREADY_APPLIED", "Cette modification est déjà appliquée.");
    if (!["REQUESTED", "PENDING_VALIDATION", "ACCEPTED", "PENDING_PAYMENT"].includes(mod.status)) throw new AppError("CONFLICT", "Cette demande ne peut plus être annulée.");
    if (mod.paymentId) await tx.payment.updateMany({ where: { id: mod.paymentId, status: "PENDING" }, data: { status: "CANCELLED" } });
    const updated = await tx.modificationRequest.update({ where: { id: mod.id }, data: { status: "CANCELLED" } });
    await audit(tx, { userId: actor.userId, action: "modification.cancel", entity: "ModificationRequest", entityId: mod.id, meta: actor.meta });
    return updated;
  });
}

/** Application manuelle (après validation et règlement). Le contrôle de stock est refait ici, avec verrouillage. */
export async function applyModification(actor: Actor, reservationId: string, modificationId: string) {
  const mod = await db.modificationRequest.findFirst({ where: { id: modificationId, reservationId } });
  if (!mod) throw notFound("Demande de modification");
  if (actor.accountType === "CLIENT" && mod.clientId !== actor.userId) throw forbidden();
  if (actor.accountType === "LENDER" && (mod.lenderId !== actor.lenderId || !can(actor, "MODIFICATION_DECIDE"))) throw forbidden();
  if (actor.accountType === "ADMIN" && !can(actor, "ADMIN_MODIFICATIONS")) throw forbidden();
  if (mod.status === "APPLIED") throw new AppError("MODIFICATION_ALREADY_APPLIED", "Cette modification est déjà appliquée.");
  if (mod.status === "PENDING_PAYMENT" || (mod.status === "ACCEPTED" && mod.differenceToPay > 0)) throw new AppError("PAYMENT_REQUIRED", "Le complément doit être réglé avant l'application.");
  if (!["ACCEPTED", "PAID"].includes(mod.status)) throw new AppError("MODIFICATION_REQUIRES_APPROVAL", "La modification doit d'abord être validée par le loueur.");
  return transaction(async (tx) => {
    await lockReservation(tx, reservationId);
    return applyModificationTx(tx, modificationId, actor.userId);
  });
}

/** Webhook de paiement d'un complément : enregistre le règlement puis applique la modification. */
export async function onModificationPaid(tx: Tx, payment: Payment) {
  await tx.payment.update({ where: { id: payment.id }, data: { status: "PAID", paidAt: new Date() } });
  await recordTransaction(tx, { type: "PAYMENT_RECEIVED", direction: "IN", amount: payment.amount, paymentId: payment.id, reservationId: payment.reservationId, metadata: { kind: "MODIFICATION" } });
  const mod = payment.modificationId ? await tx.modificationRequest.findUnique({ where: { id: payment.modificationId } }) : null;
  if (!mod || mod.status === "APPLIED") return { status: "PAID" as const };
  await lockReservation(tx, payment.reservationId);
  await tx.modificationRequest.update({ where: { id: mod.id }, data: { status: "PAID" } });
  try {
    await applyModificationTx(tx, mod.id, payment.userId);
  } catch (e) {
    if (!(e instanceof AppError) || e.code !== "STOCK_INSUFFICIENT") throw e;
    await tx.modificationRequest.update({ where: { id: mod.id }, data: { status: "CANCELLED", rejectionReason: "Stock devenu insuffisant, complément remboursé." } });
    await executeRefund(tx, { payment: { id: payment.id, amount: payment.amount, reservationId: payment.reservationId }, kind: "MODIFICATION", amount: payment.amount, reason: "Modification impossible : stock insuffisant", impacts: [] });
    await notifyUsers(tx, [mod.clientId], { type: "modification.failed", title: "Modification non appliquée", body: "Le stock n'est plus disponible : votre complément a été remboursé.", link: `/mes-reservations/${payment.reservationId}` });
  }
  return { status: "PAID" as const };
}

/**
 * Applique une modification validée et réglée : met à jour les lignes concernées, crée une nouvelle version immuable de la réservation,
 * ajuste caution, commission et solde du loueur, et rembourse la différence en cas de diminution.
 */
async function applyModificationTx(tx: Tx, modificationId: string, actorId: string) {
  const settings = await getSettings(tx);
  const mod = await tx.modificationRequest.findUniqueOrThrow({ where: { id: modificationId }, include: { lines: true, reservation: { include: { items: true } } } });
  if (mod.status === "APPLIED") throw new AppError("MODIFICATION_ALREADY_APPLIED", "Cette modification est déjà appliquée.");
  const reservation = mod.reservation;

  const plan: ModificationPlan = {
    lenderId: mod.lenderId,
    amountBefore: mod.amountBefore,
    amountAfter: mod.amountAfter,
    depositBefore: mod.depositBefore,
    depositAfter: mod.depositAfter,
    commissionBefore: mod.commissionBefore,
    commissionAfter: mod.commissionAfter,
    cashBefore: mod.cashBefore,
    cashAfter: mod.cashAfter,
    differenceToPay: mod.differenceToPay,
    refundToIssue: mod.refundToIssue,
    lines: [],
  };
  // Contrôle d'inventaire final, avec verrouillage des produits concernés.
  const proposed = mod.lines.filter((l) => l.action !== "REMOVE");
  await assertAvailable(
    tx,
    proposed.map((l) => ({ productId: l.productId, quantity: l.quantityRequested, start: l.startAfter!, end: l.endAfter! })),
    { excludeItemIds: mod.lines.filter((l) => l.itemId).map((l) => l.itemId!) },
  );
  void plan;

  const now = new Date();
  const payment = mod.paymentId ? await tx.payment.findUnique({ where: { id: mod.paymentId } }) : null;
  const initialPayment = await tx.payment.findFirst({ where: { reservationId: reservation.id, kind: "INITIAL", status: { in: ["PAID", "PARTIALLY_REFUNDED"] } } });
  const deltaCommissionTotal = mod.commissionAfter - mod.commissionBefore;
  const siblingStatus = reservation.items.find((i) => i.lenderId === mod.lenderId && MODIFIABLE.includes(i.status))?.status ?? "CONFIRMED";
  // Variation de la part de location payée en ligne (en mode espèces, le reste est réglé au loueur).
  const deltaRentalTotal = mod.amountAfter - mod.cashAfter - (mod.amountBefore - mod.cashBefore);
  const deltaDepositTotal = mod.depositAfter - mod.depositBefore;

  // 1. Trésorerie : un remboursement n'est dû que si la différence nette est négative.
  let refund: Awaited<ReturnType<typeof executeRefund>> = null;
  if (mod.refundToIssue > 0 && initialPayment) {
    const rentalRefund = Math.min(mod.refundToIssue, Math.max(0, -deltaRentalTotal));
    if (rentalRefund > 0) refund = await executeRefund(tx, { payment: initialPayment, kind: "MODIFICATION", amount: rentalRefund, reason: "Diminution de la réservation", requestedById: actorId, impacts: [] });
    const depositRefund = mod.refundToIssue - rentalRefund;
    if (depositRefund > 0) await executeRefund(tx, { payment: initialPayment, kind: "DEPOSIT_RELEASE", amount: depositRefund, reason: "Caution ajustée (modification)", requestedById: actorId, impacts: [] });
    await tx.modificationRequest.update({ where: { id: mod.id }, data: { refundId: refund?.id } });
  }

  // 2. Lignes, caution et solde du loueur.
  for (const line of mod.lines) {
    const rate = reservation.items.find((i) => i.id === line.itemId)?.commissionRateBps ?? settings["commission.rate_bps"];
    if (line.action === "REMOVE" && line.itemId) {
      const item = reservation.items.find((i) => i.id === line.itemId)!;
      const deposit = await tx.deposit.findUnique({ where: { itemId: item.id } });
      if (deposit) await tx.deposit.update({ where: { id: deposit.id }, data: { status: "RELEASED", releasedAmount: deposit.amount, settledAt: now, reason: "Ligne supprimée par modification" } });
      await tx.reservationItem.update({ where: { id: item.id }, data: { refundedRental: item.subtotal - item.cashDue } });
      await transitionItems(tx, reservation.id, "REFUNDED", { actorId, itemIds: [item.id], note: "Ligne supprimée (modification)" });
      await ledgerDelta(tx, mod.lenderId, reservation.id, item.id, -(item.subtotal - item.cashDue - item.commission), refund?.id ?? null, mod.id, "Ligne supprimée");
    } else if (line.action === "UPDATE" && line.itemId) {
      const item = reservation.items.find((i) => i.id === line.itemId)!;
      const newSubtotal = line.subtotalAfter;
      const newCommission = applyBps(newSubtotal, rate);
      const depositUnit = item.quantity > 0 ? item.depositAmount / item.quantity : 0;
      const newDeposit = Math.round(depositUnit * line.quantityRequested);
      await tx.reservationItem.update({ where: { id: item.id }, data: { quantity: line.quantityRequested, startDate: line.startAfter!, endDate: line.endAfter!, days: daysBetween(line.startAfter!, line.endAfter!), subtotal: newSubtotal, commission: newCommission, cashDue: line.cashAfter, depositAmount: newDeposit } });
      const deposit = await tx.deposit.findUnique({ where: { itemId: item.id } });
      if (deposit) await tx.deposit.update({ where: { id: deposit.id }, data: { amount: newDeposit, releaseDueDate: new Date(line.endAfter!.getTime() + settings["deposit.release_deadline_days"] * 86_400_000) } });
      const deltaDeposit = newDeposit - item.depositAmount;
      if (deltaDeposit > 0) await recordTransaction(tx, { type: "DEPOSIT_HELD", direction: "INTERNAL", amount: deltaDeposit, paymentId: payment?.id, reservationId: reservation.id, itemId: item.id, lenderId: mod.lenderId, metadata: { reason: "modification" } });
      await ledgerDelta(tx, mod.lenderId, reservation.id, item.id, newSubtotal - line.cashAfter - newCommission - (item.subtotal - item.cashDue - item.commission), refund?.id ?? null, mod.id, "Modification de la ligne", freezeUntil(line.endAfter!, settings));
      await tx.balanceEntry.updateMany({ where: { itemId: item.id, kind: "SALE", payoutId: null }, data: { availableAt: freezeUntil(line.endAfter!, settings) } });
    } else if (line.action === "ADD") {
      const created = await tx.reservationItem.create({
        data: {
          reservationId: reservation.id,
          productId: line.productId,
          lenderId: mod.lenderId,
          productName: (await tx.product.findUniqueOrThrow({ where: { id: line.productId } })).name,
          quantity: line.quantityRequested,
          startDate: line.startAfter!,
          endDate: line.endAfter!,
          days: daysBetween(line.startAfter!, line.endAfter!),
          unitPrice: line.unitPriceAfter,
          subtotal: line.subtotalAfter,
          commissionRateBps: rate,
          commission: applyBps(line.subtotalAfter, rate),
          paymentMode: line.paymentMode,
          cashDue: line.cashAfter,
          depositAmount: 0,
          refundPrice: (await tx.product.findUniqueOrThrow({ where: { id: line.productId } })).refundPrice,
          allowsExtraBilling: (await tx.product.findUniqueOrThrow({ where: { id: line.productId } })).allowsExtraBilling,
          status: siblingStatus,
        },
      });
      const product = await tx.product.findUniqueOrThrow({ where: { id: line.productId } });
      const newDeposit = product.depositAmount * line.quantityRequested;
      await tx.reservationItem.update({ where: { id: created.id }, data: { depositAmount: newDeposit } });
      await tx.deposit.create({ data: { itemId: created.id, amount: newDeposit, status: "HELD", heldAt: now, paymentId: payment?.id, releaseDueDate: new Date(line.endAfter!.getTime() + settings["deposit.release_deadline_days"] * 86_400_000) } });
      await tx.reservationStatusHistory.create({ data: { reservationId: reservation.id, itemId: created.id, toStatus: siblingStatus, actorId, note: "Ligne ajoutée par modification" } });
      if (newDeposit > 0) await recordTransaction(tx, { type: "DEPOSIT_HELD", direction: "INTERNAL", amount: newDeposit, paymentId: payment?.id, reservationId: reservation.id, itemId: created.id, lenderId: mod.lenderId });
      await ledgerDelta(tx, mod.lenderId, reservation.id, created.id, line.subtotalAfter - line.cashAfter - applyBps(line.subtotalAfter, rate), null, mod.id, "Ligne ajoutée", freezeUntil(line.endAfter!, settings));
    }
  }

  // 3. Commission : impact journalisé séparément.
  if (deltaCommissionTotal !== 0) {
    await recordTransaction(tx, { type: "ADJUSTMENT", direction: "INTERNAL", amount: Math.abs(deltaCommissionTotal), paymentId: payment?.id ?? initialPayment?.id, reservationId: reservation.id, lenderId: mod.lenderId, createdById: actorId, metadata: { reason: "Commission (modification)", delta: deltaCommissionTotal } });
  }
  if (payment) {
    await tx.paymentAllocation.create({ data: { paymentId: payment.id, reservationId: reservation.id, lenderId: mod.lenderId, rentalAmount: Math.max(0, deltaRentalTotal), deliveryAmount: 0, commissionAmount: Math.max(0, deltaCommissionTotal), netAmount: Math.max(0, deltaRentalTotal) - Math.max(0, deltaCommissionTotal), depositAmount: Math.max(0, deltaDepositTotal), cashAmount: Math.max(0, mod.cashAfter - mod.cashBefore) } });
  }

  // 4. Solde en espèces du loueur, totaux de la réservation et nouvelle version immuable.
  await syncCashSettlement(tx, reservation.id, mod.lenderId);
  const cashTotal = await cashTotalFor(tx, reservation.id);
  const fresh = await tx.reservation.findUniqueOrThrow({ where: { id: reservation.id }, include: { items: true } });
  const active = fresh.items.filter((i) => !["CANCELLED", "REFUNDED"].includes(i.status));
  const subtotal = sum(active.map((i) => i.subtotal));
  const depositTotal = sum(active.map((i) => i.depositAmount));
  const commissionTotal = sum(active.map((i) => i.commission)) + (fresh.commissionTotal - sum(reservation.items.filter((i) => !["CANCELLED", "REFUNDED"].includes(i.status)).map((i) => i.commission)));
  const version = fresh.currentVersion + 1;
  await tx.reservation.update({ where: { id: reservation.id }, data: { subtotal, depositTotal, commissionTotal, cashTotal, total: subtotal + fresh.deliveryFee + depositTotal - cashTotal, currentVersion: version } });
  const updated = await tx.reservation.findUniqueOrThrow({ where: { id: reservation.id }, include: { items: true } });
  await tx.reservationVersion.create({ data: { reservationId: reservation.id, version, snapshot: snapshotOf(updated) as Prisma.InputJsonValue, total: updated.total, deposit: updated.depositTotal, commission: updated.commissionTotal, createdById: actorId, modificationId: mod.id } });
  await tx.reservationStatusHistory.create({ data: { reservationId: reservation.id, toStatus: updated.status, actorId, note: `Modification appliquée (version ${version})` } });

  const result = await tx.modificationRequest.update({ where: { id: mod.id }, data: { status: "APPLIED", appliedAt: now }, include: { lines: true } });
  await audit(tx, { userId: actorId, lenderId: mod.lenderId, action: "modification.apply", entity: "ModificationRequest", entityId: mod.id, oldValue: { total: fresh.total }, newValue: { total: updated.total, version } });
  await notifyUsers(tx, [mod.clientId], { type: "modification.applied", title: `Réservation ${reservation.reference} modifiée`, body: mod.refundToIssue > 0 ? `${formatFcfa(mod.refundToIssue)} vous sont remboursés.` : "Votre réservation a été mise à jour.", link: `/mes-reservations/${reservation.id}` });
  await notifyLender(tx, mod.lenderId, { type: "modification.applied", title: `Réservation ${reservation.reference} modifiée`, body: "Une modification a été appliquée.", link: `/loueur/reservations/${reservation.id}` }, "ORDER_VIEW");
  return result;
}

/** Variation du solde du loueur : positive = nouvelle vente, négative = déduction (avec recouvrement si déjà versé). */
async function ledgerDelta(tx: Tx, lenderId: string, reservationId: string, itemId: string, delta: number, refundId: string | null, modificationId: string, note: string, availableAt: Date = new Date()) {
  if (delta === 0) return;
  if (delta > 0) {
    await addBalanceEntry(tx, { lenderId, kind: "SALE", amount: delta, availableAt, reservationId, itemId, note });
    return;
  }
  const sale = await tx.balanceEntry.findFirst({ where: { itemId, lenderId, kind: "SALE" } });
  const entry = await addBalanceEntry(tx, { lenderId, kind: "REFUND_DEDUCTION", amount: delta, availableAt: new Date(), reservationId, itemId, note });
  await tx.lenderReimbursement.create({ data: { refundId, modificationId, lenderId, impactedAmount: -delta, status: sale?.payoutId ? "TO_RECOVER" : "NOT_NEEDED", balanceEntryId: entry?.id, note } });
}

/** Maintenance : escalade les demandes sans réponse du loueur et expire celles qui ne sont plus valides. */
export async function escalateAndExpireModifications(now = new Date()) {
  const overdue = await db.modificationRequest.findMany({ where: { status: "PENDING_VALIDATION", escalatedAt: null, respondBy: { lt: now } }, include: { reservation: { select: { reference: true } } } });
  for (const m of overdue) {
    await transaction(async (tx) => {
      await tx.modificationRequest.update({ where: { id: m.id }, data: { escalatedAt: now, escalationNote: "Pas de réponse du loueur dans le délai : escalade automatique." } });
      await notifyAdmins(tx, { type: "modification.escalated", title: `Escalade : modification ${m.reservation.reference}`, body: "Le loueur n'a pas répondu à temps. Tranchez ou relancez.", link: `/admin/reservations/${m.reservationId}` }, "ADMIN_MODIFICATIONS");
      await notifyLender(tx, m.lenderId, { type: "modification.escalated", title: "Demande escaladée à l'administration", body: `La demande sur ${m.reservation.reference} a dépassé le délai de réponse.`, link: `/loueur/reservations/${m.reservationId}` }, "MODIFICATION_DECIDE");
      await notifyUsers(tx, [m.clientId], { type: "modification.escalated", title: "Votre demande est en cours de traitement", body: "Elle a été transmise à l'administration LOC'CONNECT.", link: `/mes-reservations/${m.reservationId}` });
    });
  }
  const stale = await db.modificationRequest.findMany({ where: { status: { in: ["PENDING_VALIDATION", "ACCEPTED", "PENDING_PAYMENT"] }, expiresAt: { lt: now } } });
  for (const m of stale) {
    await transaction(async (tx) => {
      if (m.paymentId) await tx.payment.updateMany({ where: { id: m.paymentId, status: "PENDING" }, data: { status: "CANCELLED" } });
      await tx.modificationRequest.update({ where: { id: m.id }, data: { status: "EXPIRED" } });
      await notifyUsers(tx, [m.clientId], { type: "modification.expired", title: "Demande de modification expirée", body: "Votre demande n'a pas pu être traitée à temps.", link: `/mes-reservations/${m.reservationId}` });
    });
  }
  return { escalated: overdue.length, expired: stale.length };
}
