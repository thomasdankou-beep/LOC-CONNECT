import type { Payment, ReturnCondition } from "@prisma/client";
import { formatFcfa } from "@/lib/money";
import { z } from "zod";
import { db, lockProducts, transaction, type Tx } from "@/lib/db";
import { AppError, forbidden, notFound } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { addHours } from "@/lib/dates";
import { getSettings } from "@/lib/settings";
import { can, type Actor } from "@/lib/auth/actor";
import { addBalanceEntry, executeRefund, recordTransaction } from "./finance";
import { issueDamageInvoice } from "./invoices";
import { notifyLender, notifyUsers, notifyAdmins } from "./notifications";
import { transitionItems } from "./reservations";

export const returnReportInput = z.object({
  returnedQuantity: z.number().int().min(0),
  lostQuantity: z.number().int().min(0).default(0),
  damagedQuantity: z.number().int().min(0).default(0),
  condition: z.enum(["EXCELLENT", "GOOD", "FAIR", "DAMAGED", "LOST"]).default("GOOD"),
  comment: z.string().trim().max(1000).optional(),
  /** Montant estimé des dommages pour les unités endommagées (hors unités perdues, calculées au prix de remboursement). */
  damageAmount: z.number().int().min(0).default(0),
});
export type ReturnReportInput = z.infer<typeof returnReportInput>;

export type StoredPhoto = { key: string; mimeType: string };

/** Montants d'un constat : pertes au prix de remboursement figé, dommages déclarés, retenue plafonnée par la caution. */
export function computeReturnAmounts(p: { quantity: number; lostQuantity: number; damagedQuantity: number; damageAmount: number; refundPrice: number; depositAmount: number; allowsExtraBilling: boolean }) {
  const lostAmount = p.lostQuantity * p.refundPrice;
  const totalDamage = lostAmount + p.damageAmount;
  const withheld = Math.min(totalDamage, p.depositAmount);
  const extraCharge = p.allowsExtraBilling ? totalDamage - withheld : 0;
  return { lostAmount, totalDamage, withheld, extraCharge };
}

export function validateReturnQuantities(quantity: number, i: Pick<ReturnReportInput, "returnedQuantity" | "lostQuantity" | "damagedQuantity">): void {
  if (i.returnedQuantity + i.lostQuantity !== quantity) {
    throw new AppError("VALIDATION_ERROR", `La quantité retournée (${i.returnedQuantity}) et la quantité perdue (${i.lostQuantity}) doivent totaliser la quantité louée (${quantity}).`);
  }
  if (i.damagedQuantity > i.returnedQuantity) throw new AppError("VALIDATION_ERROR", "La quantité endommagée ne peut pas dépasser la quantité retournée.");
  if (i.damagedQuantity + i.lostQuantity > quantity) throw new AppError("VALIDATION_ERROR", "Quantité endommagée + perdue supérieure à la quantité louée.");
}

function deriveCondition(i: ReturnReportInput, quantity: number): ReturnCondition {
  if (i.lostQuantity >= quantity) return "LOST";
  if (i.lostQuantity > 0 || i.damagedQuantity > 0) return "DAMAGED";
  return i.condition === "DAMAGED" || i.condition === "LOST" ? "FAIR" : i.condition;
}

/** Constat de retour par ligne. Sans dommage, la caution est libérée immédiatement ; sinon le client dispose d'une fenêtre de contestation. */
export async function createReturnReport(actor: Actor & { lenderId: string }, itemId: string, rawInput: z.input<typeof returnReportInput>, photos: StoredPhoto[]) {
  const input = returnReportInput.parse(rawInput);
  if (!can(actor, "RETURN_CREATE")) throw forbidden("Votre rôle ne permet pas de créer un constat de retour.");
  const hasDamage = input.damagedQuantity > 0 || input.lostQuantity > 0;
  if (hasDamage && !can(actor, "DAMAGE_REPORT_CREATE")) throw forbidden("Votre rôle ne permet pas de déclarer des dommages.");
  if (photos.length > 0 && !can(actor, "RETURN_EVIDENCE_CREATE")) throw forbidden("Votre rôle ne permet pas d'ajouter des preuves de retour.");
  const settings = await getSettings();

  return transaction(async (tx) => {
    const item = await tx.reservationItem.findFirst({ where: { id: itemId, lenderId: actor.lenderId }, include: { deposit: true, reservation: true, returnReport: true } });
    if (!item) throw notFound("Ligne de réservation");
    if (item.returnReport) throw new AppError("CONFLICT", "Un constat de retour existe déjà pour cette ligne.");
    if (!["IN_USE", "RETURN_PENDING"].includes(item.status)) throw new AppError("INVALID_TRANSITION", "Le constat n'est possible que pour une location en cours ou en attente de retour.");
    if (!item.deposit) throw new AppError("CONFLICT", "Aucune caution rattachée à cette ligne.");

    validateReturnQuantities(item.quantity, input);
    if (input.damagedQuantity === 0 && input.damageAmount > 0) throw new AppError("VALIDATION_ERROR", "Un montant de dommages exige au moins une unité endommagée.");
    if (input.damagedQuantity > 0 && input.damageAmount === 0) throw new AppError("VALIDATION_ERROR", "Indiquez le montant estimé des dommages.");
    if (input.damageAmount > input.damagedQuantity * item.refundPrice) throw new AppError("VALIDATION_ERROR", "Le montant des dommages dépasse le prix de remboursement des unités endommagées.");

    const amounts = computeReturnAmounts({ quantity: item.quantity, lostQuantity: input.lostQuantity, damagedQuantity: input.damagedQuantity, damageAmount: input.damageAmount, refundPrice: item.refundPrice, depositAmount: item.deposit.amount, allowsExtraBilling: item.allowsExtraBilling });
    if (amounts.totalDamage > 0 && settings["return.evidence_required"] && photos.length === 0) {
      throw new AppError("VALIDATION_ERROR", "Au moins une photo de preuve est obligatoire pour retenir une partie de la caution.");
    }

    const now = new Date();
    const report = await tx.returnReport.create({
      data: {
        itemId,
        reportedById: actor.userId,
        rentedQuantity: item.quantity,
        returnedQuantity: input.returnedQuantity,
        damagedQuantity: input.damagedQuantity,
        lostQuantity: input.lostQuantity,
        condition: deriveCondition(input, item.quantity),
        comment: input.comment,
        refundPrice: item.refundPrice,
        damageAmount: input.damageAmount,
        withheldAmount: amounts.withheld,
        extraChargeAmount: amounts.extraCharge,
        status: "SUBMITTED",
        contestDeadline: amounts.totalDamage > 0 ? addHours(now, settings["return.contest_window_hours"]) : null,
      },
    });
    if (photos.length) await tx.returnPhoto.createMany({ data: photos.map((p) => ({ reportId: report.id, storageKey: p.key, mimeType: p.mimeType, uploadedById: actor.userId })) });
    await transitionItems(tx, item.reservationId, "RETURNED", { actorId: actor.userId, itemIds: [itemId], note: "Constat de retour" });
    await audit(tx, { userId: actor.userId, lenderId: actor.lenderId, action: "return.report", entity: "ReturnReport", entityId: report.id, newValue: { ...amounts, photos: photos.length }, meta: actor.meta });

    if (amounts.totalDamage === 0) {
      await settleReport(tx, report.id, { actorId: actor.userId, note: "Retour conforme" });
    } else {
      await notifyUsers(tx, [item.reservation.clientId], {
        type: "return.reported",
        title: `Constat de retour : ${item.productName}`,
        body: `Le loueur signale des dommages (${formatFcfa(amounts.totalDamage)}). Vous pouvez accepter ou contester avant le ${addHours(now, settings["return.contest_window_hours"]).toLocaleDateString("fr-FR")}.`,
        link: `/mes-reservations/${item.reservationId}`,
      });
    }
    return tx.returnReport.findUniqueOrThrow({ where: { id: report.id }, include: { photos: true } });
  });
}

/**
 * Règle la caution d'une ligne selon le constat : retenue (créditée au loueur, sans commission), libération du reste au client,
 * complément éventuel à payer si le produit l'autorise, sortie du stock des unités perdues. La ligne passe à COMPLETED.
 * `acceptedTotal` permet à l'arbitrage (litige, administration) de fixer le montant de dommages finalement retenu.
 */
export async function settleReport(tx: Tx, reportId: string, opts: { actorId?: string | null; acceptedTotal?: number; note?: string; resolved?: boolean } = {}) {
  const report = await tx.returnReport.findUniqueOrThrow({ where: { id: reportId }, include: { item: { include: { deposit: true, reservation: true, product: true } } } });
  if (report.settledAt) return report;
  const item = report.item;
  const deposit = item.deposit!;
  const base = computeReturnAmounts({ quantity: item.quantity, lostQuantity: report.lostQuantity, damagedQuantity: report.damagedQuantity, damageAmount: report.damageAmount, refundPrice: report.refundPrice, depositAmount: deposit.amount, allowsExtraBilling: item.allowsExtraBilling });
  const totalDamage = Math.max(0, opts.acceptedTotal ?? base.totalDamage);
  const withheld = Math.min(totalDamage, deposit.amount);
  const extra = item.allowsExtraBilling ? totalDamage - withheld : 0;
  const released = deposit.amount - withheld;
  const now = new Date();

  await tx.deposit.update({
    where: { id: deposit.id },
    data: { withheldAmount: withheld, releasedAmount: released, status: withheld === 0 ? "RELEASED" : withheld >= deposit.amount ? "FULLY_WITHHELD" : "PARTIALLY_WITHHELD", settledAt: now, frozen: false, reason: opts.note ?? (withheld > 0 ? "Retenue après constat de retour" : "Retour conforme") },
  });

  const payment = deposit.paymentId ? await tx.payment.findUnique({ where: { id: deposit.paymentId } }) : null;
  if (withheld > 0) {
    await recordTransaction(tx, { type: "DEPOSIT_WITHHELD", direction: "INTERNAL", amount: withheld, paymentId: payment?.id, reservationId: item.reservationId, itemId: item.id, lenderId: item.lenderId, createdById: opts.actorId, metadata: { reportId } });
    await addBalanceEntry(tx, { lenderId: item.lenderId, kind: "DEPOSIT_CAPTURE", amount: withheld, availableAt: now, reservationId: item.reservationId, itemId: item.id, note: "Retenue de caution" });
  }
  if (released > 0 && payment) {
    await executeRefund(tx, { payment: { id: payment.id, amount: payment.amount, reservationId: payment.reservationId }, kind: "DEPOSIT_RELEASE", amount: released, reason: `Libération de la caution (${item.productName})`, requestedById: opts.actorId, impacts: [] });
  }
  if (extra > 0) {
    await tx.extraCharge.create({ data: { itemId: item.id, reportId, amount: extra, reason: `Dommages au-delà de la caution (${item.productName})` } });
    await notifyUsers(tx, [item.reservation.clientId], { type: "extra_charge.created", title: "Complément à régler", body: `Un complément de ${formatFcfa(extra)} est dû pour ${item.productName}.`, link: `/mes-reservations/${item.reservationId}` });
  }
  if (report.lostQuantity > 0) {
    await lockProducts(tx, [item.productId]);
    const product = await tx.product.findUniqueOrThrow({ where: { id: item.productId } });
    const newQty = Math.max(0, product.stockQuantity - report.lostQuantity);
    await tx.product.update({ where: { id: item.productId }, data: { stockQuantity: newQty } });
    await tx.stockMovement.create({ data: { productId: item.productId, delta: newQty - product.stockQuantity, previousQty: product.stockQuantity, newQty, reason: "LOST", note: `Retour ${item.reservation.reference}`, createdById: opts.actorId } });
  }

  await tx.balanceEntry.updateMany({ where: { itemId: item.id, blocked: true }, data: { blocked: false } });
  await issueDamageInvoice(tx, reportId, { accepted: totalDamage, withheld, released, extraCharge: extra, resolution: opts.resolved ? opts.note ?? null : null });
  await tx.returnReport.update({ where: { id: reportId }, data: { status: opts.resolved ? "RESOLVED" : "VALIDATED", settledAt: now, withheldAmount: withheld, extraChargeAmount: extra } });
  await transitionItems(tx, item.reservationId, "COMPLETED", { actorId: opts.actorId, itemIds: [item.id], onlyFrom: ["RETURNED"], note: "Caution réglée" });

  await notifyUsers(tx, [item.reservation.clientId], {
    type: "deposit.settled",
    title: `Caution ${withheld > 0 ? "retenue en partie" : "libérée"} : ${item.productName}`,
    body: withheld > 0 ? `${formatFcfa(withheld)} retenus, ${formatFcfa(released)} restitués.` : `${formatFcfa(released)} restitués.`,
    link: `/mes-reservations/${item.reservationId}`,
  });
  await notifyLender(tx, item.lenderId, { type: "deposit.settled", title: `Caution réglée : ${item.productName}`, body: withheld > 0 ? `${formatFcfa(withheld)} vous sont crédités.` : "Aucune retenue.", link: `/loueur/cautions` }, "DEPOSIT_VIEW");
  await audit(tx, { userId: opts.actorId, lenderId: item.lenderId, action: "deposit.settle", entity: "Deposit", entityId: deposit.id, oldValue: { amount: deposit.amount }, newValue: { withheld, released, extra } });
  return report;
}

async function ownReport(tx: Tx, clientId: string, itemId: string) {
  const report = await tx.returnReport.findFirst({ where: { itemId, item: { reservation: { clientId } } }, include: { item: true } });
  if (!report) throw notFound("Constat de retour");
  return report;
}

/** Le client accepte le constat : règlement immédiat de la caution. */
export async function acknowledgeReport(actor: Actor, itemId: string) {
  return transaction(async (tx) => {
    const report = await ownReport(tx, actor.userId, itemId);
    if (report.status !== "SUBMITTED") throw new AppError("CONFLICT", "Ce constat ne peut plus être accepté.");
    await tx.returnReport.update({ where: { id: report.id }, data: { acknowledgedAt: new Date() } });
    await settleReport(tx, report.id, { actorId: actor.userId, note: "Constat accepté par le client" });
    return tx.returnReport.findUniqueOrThrow({ where: { id: report.id } });
  });
}

/** Le client conteste dans la fenêtre : la caution est gelée, les versements liés sont bloqués et un litige ciblé est ouvert. */
export async function contestReport(actor: Actor, itemId: string, reason: string) {
  const { openDisputeTx } = await import("./disputes");
  return transaction(async (tx) => {
    const report = await ownReport(tx, actor.userId, itemId);
    if (report.status !== "SUBMITTED") throw new AppError("CONFLICT", "Ce constat ne peut plus être contesté.");
    if (!report.contestDeadline || report.contestDeadline < new Date()) throw new AppError("CONFLICT", "La fenêtre de contestation est terminée.");
    await tx.returnReport.update({ where: { id: report.id }, data: { status: "CONTESTED", contestedAt: new Date(), contestReason: reason } });
    await tx.deposit.update({ where: { itemId }, data: { frozen: true } });
    await tx.balanceEntry.updateMany({ where: { itemId }, data: { blocked: true } });
    const dispute = await openDisputeTx(tx, actor, { reservationId: report.item.reservationId, itemId, lenderId: report.item.lenderId, reason: "Contestation du constat de retour", description: reason, disputedAmount: report.withheldAmount + report.extraChargeAmount });
    await audit(tx, { userId: actor.userId, action: "return.contest", entity: "ReturnReport", entityId: report.id, newValue: { reason, dispute: dispute.id }, meta: actor.meta });
    await notifyLender(tx, report.item.lenderId, { type: "return.contested", title: "Constat de retour contesté", body: `Le client conteste le constat de ${report.item.productName}. La caution est gelée jusqu'à résolution.`, link: `/loueur/litiges/${dispute.id}` }, "DISPUTE_VIEW");
    await notifyAdmins(tx, { type: "dispute.opened", title: "Nouveau litige (constat contesté)", body: dispute.reference, link: `/admin/litiges/${dispute.id}` }, "ADMIN_DISPUTES");
    return dispute;
  });
}

/** Règle les constats dont la fenêtre de contestation est écoulée sans contestation. */
export async function settleExpiredReports(now = new Date()): Promise<number> {
  const due = await db.returnReport.findMany({ where: { status: "SUBMITTED", settledAt: null, contestDeadline: { lte: now } }, select: { id: true } });
  let n = 0;
  for (const r of due) {
    await transaction(async (tx) => {
      await settleReport(tx, r.id, { actorId: null, note: "Fenêtre de contestation écoulée" });
    });
    n++;
  }
  return n;
}

/** Libération de la caution par le loueur (renonciation à toute retenue) ou par l'administration, après constat. */
export async function releaseDeposit(actor: Actor, depositId: string, note?: string) {
  return transaction(async (tx) => {
    const deposit = await tx.deposit.findUnique({ where: { id: depositId }, include: { item: { include: { returnReport: true } } } });
    if (!deposit) throw notFound("Caution");
    if (actor.accountType === "ADMIN") {
      if (!can(actor, "ADMIN_DEPOSITS")) throw forbidden();
    } else if (actor.accountType === "LENDER" && actor.lenderId === deposit.item.lenderId) {
      if (!can(actor, "RETURN_CREATE")) throw forbidden();
    } else throw forbidden();
    const report = deposit.item.returnReport;
    if (!report) throw new AppError("CONFLICT", "Un constat de retour est obligatoire avant de libérer la caution.");
    if (deposit.settledAt) throw new AppError("CONFLICT", "La caution est déjà réglée.");
    if (deposit.frozen && actor.accountType !== "ADMIN") throw new AppError("CONFLICT", "La caution est gelée par une contestation.");
    await settleReport(tx, report.id, { actorId: actor.userId, acceptedTotal: 0, note: note ?? "Libération décidée", resolved: true });
    return tx.deposit.findUniqueOrThrow({ where: { id: depositId } });
  });
}

/** Retenue décidée par l'administration (arbitrage) : montant plafonné par la caution, motif obligatoire, audité. */
export async function withholdDeposit(actor: Actor, depositId: string, amount: number, reason: string) {
  if (actor.accountType !== "ADMIN" || !can(actor, "ADMIN_DEPOSITS")) throw forbidden();
  return transaction(async (tx) => {
    const deposit = await tx.deposit.findUnique({ where: { id: depositId }, include: { item: { include: { returnReport: true } } } });
    if (!deposit) throw notFound("Caution");
    if (!deposit.item.returnReport) throw new AppError("CONFLICT", "Aucune retenue sans constat de retour conforme aux règles.");
    if (deposit.settledAt) throw new AppError("CONFLICT", "La caution est déjà réglée.");
    if (amount < 0 || amount > deposit.amount) throw new AppError("VALIDATION_ERROR", "La retenue est plafonnée par le montant de la caution.");
    await settleReport(tx, deposit.item.returnReport.id, { actorId: actor.userId, acceptedTotal: amount, note: reason, resolved: true });
    return tx.deposit.findUniqueOrThrow({ where: { id: depositId } });
  });
}

/** Règlement d'un complément de dommages (EXTRA_CHARGE) confirmé par le webhook de paiement. */
export async function onExtraChargePaid(tx: Tx, payment: Payment) {
  const charge = await tx.extraCharge.findFirst({ where: { id: payment.extraChargeId ?? "" }, include: { item: true } });
  await tx.payment.update({ where: { id: payment.id }, data: { status: "PAID", paidAt: new Date() } });
  await recordTransaction(tx, { type: "PAYMENT_RECEIVED", direction: "IN", amount: payment.amount, paymentId: payment.id, reservationId: payment.reservationId, metadata: { kind: "EXTRA_CHARGE" } });
  if (charge) {
    await tx.extraCharge.update({ where: { id: charge.id }, data: { status: "PAID" } });
    await recordTransaction(tx, { type: "EXTRA_CHARGE", direction: "INTERNAL", amount: charge.amount, paymentId: payment.id, reservationId: charge.item.reservationId, itemId: charge.itemId, lenderId: charge.item.lenderId });
    await addBalanceEntry(tx, { lenderId: charge.item.lenderId, kind: "DEPOSIT_CAPTURE", amount: charge.amount, availableAt: new Date(), reservationId: charge.item.reservationId, itemId: charge.itemId, note: "Complément de dommages" });
    await notifyLender(tx, charge.item.lenderId, { type: "extra_charge.paid", title: "Complément de dommages payé", body: `${formatFcfa(charge.amount)} crédités pour ${charge.item.productName}.`, link: "/loueur/cautions" }, "DEPOSIT_VIEW");
  }
  await notifyUsers(tx, [payment.userId], { type: "payment.succeeded", title: "Complément réglé", body: `Votre paiement ${payment.reference} a été reçu.`, link: `/mes-reservations/${payment.reservationId}` });
  return { status: "PAID" as const };
}

export async function listLenderDeposits(lenderId: string, opts: { status?: string; page?: number; pageSize?: number } = {}) {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = opts.pageSize ?? 15;
  const where = { item: { lenderId }, ...(opts.status ? { status: opts.status as never } : {}) };
  const [total, rows] = await Promise.all([
    db.deposit.count({ where }),
    db.deposit.findMany({ where, include: { item: { include: { reservation: { select: { reference: true, id: true } }, returnReport: { select: { status: true, contestDeadline: true } } } } }, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
  ]);
  return { rows, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function listLenderReturns(lenderId: string) {
  const [toReturn, reports] = await Promise.all([
    db.reservationItem.findMany({ where: { lenderId, status: { in: ["IN_USE", "RETURN_PENDING"] }, returnReport: null }, include: { reservation: { select: { reference: true, id: true, client: { select: { firstName: true, lastName: true } } } }, deposit: true }, orderBy: { endDate: "asc" } }),
    db.returnReport.findMany({ where: { item: { lenderId } }, include: { item: { include: { reservation: { select: { reference: true, id: true } } } }, photos: { select: { id: true } } }, orderBy: { createdAt: "desc" }, take: 30 }),
  ]);
  return { toReturn, reports };
}
