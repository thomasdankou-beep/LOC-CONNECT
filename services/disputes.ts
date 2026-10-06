import { z } from "zod";
import type { DisputeStatus, Prisma } from "@prisma/client";
import { db, transaction, type Tx } from "@/lib/db";
import { AppError, forbidden, notFound } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { reference } from "@/lib/ids";
import { can, type Actor } from "@/lib/auth/actor";
import { DISPUTABLE_STATUSES } from "@/lib/state-machine";
import { executeRefund } from "./finance";
import { notifyAdmins, notifyLender, notifyUsers } from "./notifications";
import { transitionItems } from "./reservations";

export const disputeInput = z.object({
  itemId: z.string().optional(),
  lenderId: z.string().min(1),
  reason: z.string().trim().min(3).max(120),
  description: z.string().trim().min(10).max(2000),
  disputedAmount: z.number().int().min(0).default(0),
});
export type DisputeInput = z.infer<typeof disputeInput> & { reservationId: string };

/**
 * Ouvre un litige ciblé sur un loueur (et éventuellement une ligne). Seules les lignes de ce loueur passent en litige :
 * les autres loueurs de la réservation ne sont pas impactés.
 */
export async function openDisputeTx(tx: Tx, actor: Actor, input: DisputeInput) {
  const reservation = await tx.reservation.findFirst({ where: { id: input.reservationId, clientId: actor.userId }, include: { items: true } });
  if (!reservation) throw notFound("Réservation");
  const lenderItems = reservation.items.filter((i) => i.lenderId === input.lenderId);
  if (lenderItems.length === 0) throw new AppError("VALIDATION_ERROR", "Ce loueur n'est pas concerné par cette réservation.");
  const targets = (input.itemId ? lenderItems.filter((i) => i.id === input.itemId) : lenderItems).filter((i) => DISPUTABLE_STATUSES.includes(i.status));
  if (targets.length === 0) throw new AppError("CONFLICT", "Aucune ligne de cette réservation ne peut faire l'objet d'un litige pour le moment.");
  // Plafond : location, caution et valeur de remplacement des articles (un constat peut retenir jusqu'à cette valeur).
  const maxAmount = targets.reduce((a, i) => a + i.subtotal + i.depositAmount + i.refundPrice * i.quantity, 0);
  if (input.disputedAmount > maxAmount) throw new AppError("VALIDATION_ERROR", "Le montant contesté dépasse le montant des lignes concernées.");

  const dispute = await tx.dispute.create({
    data: {
      reference: reference("LIT", 7),
      reservationId: reservation.id,
      itemId: input.itemId ?? (targets.length === 1 ? targets[0].id : null),
      lenderId: input.lenderId,
      openedById: actor.userId,
      reason: input.reason,
      description: input.description,
      disputedAmount: input.disputedAmount,
      messages: { create: { authorId: actor.userId, message: input.description } },
    },
  });
  for (const item of targets) {
    if (item.status !== "DISPUTED") await transitionItems(tx, reservation.id, "DISPUTED", { actorId: actor.userId, itemIds: [item.id], note: `Litige ${dispute.reference}` });
    await tx.balanceEntry.updateMany({ where: { itemId: item.id, payoutId: null }, data: { blocked: true } });
  }
  await audit(tx, { userId: actor.userId, action: "dispute.open", entity: "Dispute", entityId: dispute.id, newValue: { reason: input.reason, amount: input.disputedAmount, lenderId: input.lenderId }, meta: actor.meta });
  return dispute;
}

export async function openDispute(actor: Actor, input: DisputeInput) {
  if (actor.accountType !== "CLIENT") throw forbidden("Seul un client peut ouvrir un litige.");
  const dispute = await transaction((tx) => openDisputeTx(tx, actor, input));
  await transaction(async (tx) => {
    await notifyLender(tx, input.lenderId, { type: "dispute.opened", title: `Litige ${dispute.reference}`, body: input.reason, link: `/loueur/litiges/${dispute.id}` }, "DISPUTE_VIEW");
    await notifyAdmins(tx, { type: "dispute.opened", title: `Nouveau litige ${dispute.reference}`, body: input.reason, link: `/admin/litiges/${dispute.id}` }, "ADMIN_DISPUTES");
  });
  return dispute;
}

const disputeInclude = {
  messages: { include: { author: { select: { firstName: true, lastName: true, accountType: true } }, attachments: true }, orderBy: { createdAt: "asc" as const } },
  attachments: true,
  reservation: { select: { id: true, reference: true, clientId: true } },
  item: { select: { id: true, productName: true, status: true, returnReport: { select: { id: true, status: true, withheldAmount: true, extraChargeAmount: true } } } },
  lender: { select: { id: true, companyName: true } },
  openedBy: { select: { firstName: true, lastName: true } },
} satisfies Prisma.DisputeInclude;

export async function getDisputeForActor(actor: Actor, id: string) {
  const dispute = await db.dispute.findUnique({ where: { id }, include: disputeInclude });
  if (!dispute) throw notFound("Litige");
  if (actor.accountType === "CLIENT" && dispute.reservation.clientId !== actor.userId) throw forbidden();
  if (actor.accountType === "LENDER" && (dispute.lenderId !== actor.lenderId || !can(actor, "DISPUTE_VIEW"))) throw forbidden();
  if (actor.accountType === "ADMIN" && !can(actor, "ADMIN_DISPUTES")) throw forbidden();
  return dispute;
}

export async function addMessage(actor: Actor, disputeId: string, message: string, attachments: { key: string; fileName: string; mimeType: string; size: number }[] = []) {
  const dispute = await getDisputeForActor(actor, disputeId);
  if (actor.accountType === "LENDER" && !can(actor, "DISPUTE_RESPOND")) throw forbidden();
  if (["RESOLVED", "REJECTED", "CLOSED"].includes(dispute.status)) throw new AppError("CONFLICT", "Ce litige est clos.");
  return transaction(async (tx) => {
    const msg = await tx.disputeMessage.create({
      data: { disputeId, authorId: actor.userId, message, attachments: { create: attachments.map((a) => ({ disputeId, storageKey: a.key, fileName: a.fileName, mimeType: a.mimeType, size: a.size, uploadedById: actor.userId })) } },
    });
    if (actor.accountType === "LENDER" && dispute.status === "WAITING_RESPONSE") await tx.dispute.update({ where: { id: disputeId }, data: { status: "UNDER_REVIEW" } });
    await tx.dispute.update({ where: { id: disputeId }, data: { updatedAt: new Date() } });
    const link = (base: string) => `${base}/${disputeId}`;
    if (actor.accountType !== "CLIENT") await notifyUsers(tx, [dispute.reservation.clientId], { type: "dispute.message", title: `Nouveau message, litige ${dispute.reference}`, body: message.slice(0, 140), link: link("/mes-litiges") });
    if (actor.accountType !== "LENDER" && dispute.lenderId) await notifyLender(tx, dispute.lenderId, { type: "dispute.message", title: `Nouveau message, litige ${dispute.reference}`, body: message.slice(0, 140), link: link("/loueur/litiges") }, "DISPUTE_VIEW");
    if (actor.accountType !== "ADMIN") await notifyAdmins(tx, { type: "dispute.message", title: `Nouveau message, litige ${dispute.reference}`, body: message.slice(0, 140), link: link("/admin/litiges") }, "ADMIN_DISPUTES");
    return msg;
  });
}

export async function setDisputeStatus(actor: Actor, disputeId: string, status: DisputeStatus) {
  if (actor.accountType !== "ADMIN" || !can(actor, "ADMIN_DISPUTES")) throw forbidden();
  if (!["UNDER_REVIEW", "WAITING_RESPONSE", "CLOSED"].includes(status)) throw new AppError("VALIDATION_ERROR", "Utilisez la décision pour résoudre ou rejeter un litige.");
  const dispute = await db.dispute.findUnique({ where: { id: disputeId } });
  if (!dispute) throw notFound("Litige");
  if (["RESOLVED", "REJECTED", "CLOSED"].includes(dispute.status)) throw new AppError("CONFLICT", "Ce litige est déjà clos.");
  return transaction(async (tx) => {
    const updated = await tx.dispute.update({ where: { id: disputeId }, data: { status } });
    await audit(tx, { userId: actor.userId, action: "dispute.status", entity: "Dispute", entityId: disputeId, oldValue: { status: dispute.status }, newValue: { status }, meta: actor.meta });
    return updated;
  });
}

export const decisionInput = z.object({
  outcome: z.enum(["CLIENT_FAVOR", "LENDER_FAVOR", "PARTIAL"]),
  amount: z.number().int().min(0).optional(),
  decision: z.string().trim().min(5).max(1500),
});

async function restoreItem(tx: Tx, reservationId: string, itemId: string, actorId: string) {
  const open = await tx.dispute.count({ where: { itemId, status: { notIn: ["RESOLVED", "REJECTED", "CLOSED"] } } });
  if (open > 0) return;
  const item = await tx.reservationItem.findUniqueOrThrow({ where: { id: itemId } });
  if (item.status === "DISPUTED") {
    const last = await tx.reservationStatusHistory.findFirst({ where: { itemId, toStatus: "DISPUTED" }, orderBy: { createdAt: "desc" } });
    const back = last?.fromStatus ?? "COMPLETED";
    await transitionItems(tx, reservationId, back, { actorId, itemIds: [itemId], note: "Litige clos" });
  }
  const contested = await tx.returnReport.count({ where: { itemId, status: "CONTESTED" } });
  if (contested === 0) await tx.balanceEntry.updateMany({ where: { itemId, blocked: true }, data: { blocked: false } });
}

/**
 * Décision de l'administration. Pour une contestation de constat : fixe le montant de dommages finalement retenu et règle la caution.
 * Pour les autres litiges : rembourse le client (montant décidé) en déduisant la part du loueur, avec recouvrement si déjà versé.
 */
export async function decideDispute(actor: Actor, disputeId: string, input: z.infer<typeof decisionInput>) {
  if (actor.accountType !== "ADMIN" || !can(actor, "ADMIN_DISPUTES")) throw forbidden();
  const dispute = await db.dispute.findUnique({ where: { id: disputeId }, include: { item: { include: { returnReport: true, deposit: true } }, reservation: true } });
  if (!dispute) throw notFound("Litige");
  if (["RESOLVED", "REJECTED", "CLOSED"].includes(dispute.status)) throw new AppError("CONFLICT", "Ce litige est déjà clos.");
  if (input.outcome === "PARTIAL" && (input.amount == null)) throw new AppError("VALIDATION_ERROR", "Indiquez le montant retenu pour une décision partielle.");

  return transaction(async (tx) => {
    const item = dispute.item;
    const report = item?.returnReport;
    let resolutionAmount = 0;

    if (item && report && report.status === "CONTESTED") {
      const { settleReport, computeReturnAmounts } = await import("./returns");
      const original = computeReturnAmounts({ quantity: item.quantity, lostQuantity: report.lostQuantity, damagedQuantity: report.damagedQuantity, damageAmount: report.damageAmount, refundPrice: report.refundPrice, depositAmount: item.deposit?.amount ?? 0, allowsExtraBilling: item.allowsExtraBilling });
      const accepted = input.outcome === "LENDER_FAVOR" ? original.totalDamage : input.outcome === "CLIENT_FAVOR" ? 0 : Math.min(input.amount ?? 0, original.totalDamage);
      resolutionAmount = accepted;
      if (item.status === "DISPUTED") await transitionItems(tx, dispute.reservationId, "RETURNED", { actorId: actor.userId, itemIds: [item.id], note: `Décision litige ${dispute.reference}` });
      await settleReport(tx, report.id, { actorId: actor.userId, acceptedTotal: accepted, note: input.decision, resolved: true });
    } else if (input.outcome !== "LENDER_FAVOR") {
      const amount = input.outcome === "CLIENT_FAVOR" ? (input.amount ?? dispute.disputedAmount) : (input.amount ?? 0);
      if (amount > 0) {
        const payment = await tx.payment.findFirst({ where: { reservationId: dispute.reservationId, kind: "INITIAL", status: { in: ["PAID", "PARTIALLY_REFUNDED"] } } });
        if (!payment) throw new AppError("CONFLICT", "Aucun paiement remboursable pour ce litige.");
        const refund = await executeRefund(tx, { payment, kind: "DISPUTE", amount, reason: `Décision du litige ${dispute.reference}`, requestedById: actor.userId, impacts: dispute.lenderId ? [{ lenderId: dispute.lenderId, amount, itemId: dispute.itemId, note: `Litige ${dispute.reference}` }] : [] });
        resolutionAmount = refund?.amount ?? 0;
      }
    }

    const updated = await tx.dispute.update({
      where: { id: disputeId },
      data: { status: input.outcome === "LENDER_FAVOR" ? "REJECTED" : "RESOLVED", decision: input.decision, decidedById: actor.userId, decidedAt: new Date(), resolutionAmount },
    });
    const targets = dispute.itemId ? [dispute.itemId] : (await tx.reservationItem.findMany({ where: { reservationId: dispute.reservationId, lenderId: dispute.lenderId ?? "", status: "DISPUTED" }, select: { id: true } })).map((i) => i.id);
    for (const id of targets) await restoreItem(tx, dispute.reservationId, id, actor.userId);

    await audit(tx, { userId: actor.userId, action: "dispute.decide", entity: "Dispute", entityId: disputeId, newValue: { outcome: input.outcome, resolutionAmount, decision: input.decision }, meta: actor.meta });
    await notifyUsers(tx, [dispute.reservation.clientId], { type: "dispute.decided", title: `Litige ${dispute.reference} : décision rendue`, body: input.decision.slice(0, 160), link: `/mes-litiges/${disputeId}` });
    if (dispute.lenderId) await notifyLender(tx, dispute.lenderId, { type: "dispute.decided", title: `Litige ${dispute.reference} : décision rendue`, body: input.decision.slice(0, 160), link: `/loueur/litiges/${disputeId}` }, "DISPUTE_VIEW");
    return updated;
  });
}

export async function listDisputes(actor: Actor, opts: { status?: DisputeStatus; page?: number; pageSize?: number } = {}) {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = opts.pageSize ?? 15;
  const where: Prisma.DisputeWhereInput = {
    ...(opts.status ? { status: opts.status } : {}),
    ...(actor.accountType === "CLIENT" ? { openedById: actor.userId } : {}),
    ...(actor.accountType === "LENDER" ? { lenderId: actor.lenderId ?? "none" } : {}),
  };
  if (actor.accountType === "ADMIN" && !can(actor, "ADMIN_DISPUTES")) throw forbidden();
  if (actor.accountType === "LENDER" && !can(actor, "DISPUTE_VIEW")) throw forbidden();
  const [total, rows] = await Promise.all([
    db.dispute.count({ where }),
    db.dispute.findMany({ where, include: { reservation: { select: { reference: true, id: true } }, lender: { select: { companyName: true } }, item: { select: { productName: true } }, openedBy: { select: { firstName: true, lastName: true } } }, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
  ]);
  return { rows, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}
