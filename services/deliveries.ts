import { z } from "zod";
import type { DeliveryStatus, Prisma } from "@prisma/client";
import { db, transaction } from "@/lib/db";
import { AppError, forbidden, notFound } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { parseDate } from "@/lib/dates";
import { can, type Actor } from "@/lib/auth/actor";
import { notifyUsers } from "./notifications";
import { transitionItems } from "./reservations";

const DELIVERY_FLOW: Record<DeliveryStatus, DeliveryStatus[]> = {
  PENDING: ["PREPARING", "FAILED"],
  PREPARING: ["OUT_FOR_DELIVERY", "FAILED"],
  OUT_FOR_DELIVERY: ["DELIVERED", "FAILED"],
  DELIVERED: ["RETURNED"],
  FAILED: ["PREPARING"],
  RETURNED: [],
};

export const deliveryUpdate = z.object({
  status: z.enum(["PENDING", "PREPARING", "OUT_FOR_DELIVERY", "DELIVERED", "FAILED", "RETURNED"]).optional(),
  scheduledDate: z.string().optional(),
  slotStart: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  slotEnd: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  assignedToId: z.string().nullable().optional(),
  notes: z.string().trim().max(500).optional(),
});

async function loadForActor(actor: Actor, deliveryId: string) {
  const delivery = await db.delivery.findUnique({ where: { id: deliveryId }, include: { reservation: { select: { id: true, reference: true, clientId: true, status: true } }, proofs: true, lender: { select: { companyName: true } } } });
  if (!delivery) throw notFound("Livraison");
  if (actor.accountType === "CLIENT" && delivery.reservation.clientId !== actor.userId) throw forbidden();
  if (actor.accountType === "LENDER" && (delivery.lenderId !== actor.lenderId || !can(actor, "DELIVERY_VIEW"))) throw forbidden();
  if (actor.accountType === "ADMIN" && !can(actor, "ADMIN_DELIVERIES")) throw forbidden();
  return delivery;
}

export const getDeliveryForActor = loadForActor;

/** Mise à jour d'une livraison par le loueur : le statut de suivi fait avancer les lignes de réservation correspondantes. */
export async function updateDelivery(actor: Actor & { lenderId: string }, deliveryId: string, input: z.infer<typeof deliveryUpdate>) {
  if (!can(actor, "DELIVERY_UPDATE")) throw forbidden("Votre rôle ne permet pas de mettre à jour les livraisons.");
  const delivery = await loadForActor(actor, deliveryId);
  if (!["CONFIRMED", "PAID", "READY", "DELIVERING", "DELIVERED", "IN_USE"].includes(delivery.reservation.status) && delivery.reservation.status !== "RETURN_PENDING") {
    throw new AppError("CONFLICT", "Cette réservation n'est pas encore payée ou a été annulée.");
  }
  if (input.assignedToId) {
    const member = await db.lenderMember.findFirst({ where: { userId: input.assignedToId, lenderId: actor.lenderId, status: "ACTIVE" } });
    const owner = await db.lender.findFirst({ where: { id: actor.lenderId, ownerId: input.assignedToId } });
    if (!member && !owner) throw new AppError("VALIDATION_ERROR", "Le responsable doit appartenir à votre entreprise.");
  }
  return transaction(async (tx) => {
    const data: Prisma.DeliveryUpdateInput = {};
    if (input.scheduledDate) data.scheduledDate = parseDate(input.scheduledDate);
    if (input.slotStart) data.slotStart = input.slotStart;
    if (input.slotEnd) data.slotEnd = input.slotEnd;
    if (input.notes !== undefined) data.notes = input.notes;
    if (input.assignedToId !== undefined) data.assignedToId = input.assignedToId;

    if (input.status && input.status !== delivery.status) {
      if (!DELIVERY_FLOW[delivery.status].includes(input.status)) throw new AppError("INVALID_TRANSITION", `Transition de livraison impossible : ${delivery.status} vers ${input.status}.`);
      data.status = input.status;
      const reservationId = delivery.reservationId;
      const scope = { actorId: actor.userId, lenderId: actor.lenderId };
      if (input.status === "OUT_FOR_DELIVERY") await transitionItems(tx, reservationId, "DELIVERING", { ...scope, onlyFrom: ["READY"], note: "Livraison en route" });
      if (input.status === "DELIVERED") {
        data.deliveredAt = new Date();
        await transitionItems(tx, reservationId, "DELIVERED", { ...scope, onlyFrom: ["DELIVERING"], note: "Livré" });
      }
      if (input.status === "FAILED") await transitionItems(tx, reservationId, "READY", { ...scope, onlyFrom: ["DELIVERING"], note: "Échec de livraison" });
      await notifyUsers(tx, [delivery.reservation.clientId], { type: "delivery.updated", title: `Livraison ${delivery.reservation.reference}`, body: DELIVERY_MESSAGES[input.status], link: `/mes-reservations/${reservationId}` });
    }
    const updated = await tx.delivery.update({ where: { id: deliveryId }, data });
    await audit(tx, { userId: actor.userId, lenderId: actor.lenderId, action: "delivery.update", entity: "Delivery", entityId: deliveryId, oldValue: { status: delivery.status }, newValue: input, meta: actor.meta });
    return updated;
  });
}

const DELIVERY_MESSAGES: Record<DeliveryStatus, string> = {
  PENDING: "Votre livraison est à planifier.",
  PREPARING: "Votre commande est en préparation.",
  OUT_FOR_DELIVERY: "Votre commande est en route.",
  DELIVERED: "Votre commande a été livrée.",
  FAILED: "La livraison a échoué, le loueur vous recontactera.",
  RETURNED: "Le matériel a été récupéré par le loueur.",
};

export async function addDeliveryProof(actor: Actor & { lenderId: string }, deliveryId: string, proof: { key?: string; type: "PHOTO" | "SIGNATURE" | "NOTE"; note?: string }) {
  if (!can(actor, "DELIVERY_PROOF_CREATE")) throw forbidden("Votre rôle ne permet pas d'ajouter une preuve de livraison.");
  const delivery = await loadForActor(actor, deliveryId);
  const row = await db.deliveryProof.create({ data: { deliveryId: delivery.id, type: proof.type, storageKey: proof.key, note: proof.note } });
  await audit(db, { userId: actor.userId, lenderId: actor.lenderId, action: "delivery.proof", entity: "Delivery", entityId: deliveryId, newValue: { type: proof.type }, meta: actor.meta });
  return row;
}

export async function listLenderDeliveries(lenderId: string, opts: { status?: DeliveryStatus; page?: number; pageSize?: number } = {}) {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = opts.pageSize ?? 15;
  const where: Prisma.DeliveryWhereInput = { lenderId, ...(opts.status ? { status: opts.status } : {}), reservation: { status: { notIn: ["HOLD", "PENDING_PAYMENT", "DRAFT", "CANCELLED", "REFUNDED"] } } };
  const [total, rows] = await Promise.all([
    db.delivery.count({ where }),
    db.delivery.findMany({ where, include: { reservation: { select: { reference: true, id: true, client: { select: { firstName: true, lastName: true, phone: true } }, items: { where: { lenderId }, select: { productName: true, quantity: true, status: true } } } }, proofs: true }, orderBy: [{ scheduledDate: "asc" }], skip: (page - 1) * pageSize, take: pageSize }),
  ]);
  return { rows, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function listAdminDeliveries(page = 1, pageSize = 20, status?: DeliveryStatus) {
  const where: Prisma.DeliveryWhereInput = { ...(status ? { status } : {}), reservation: { status: { notIn: ["HOLD", "PENDING_PAYMENT", "DRAFT"] } } };
  const [total, rows] = await Promise.all([
    db.delivery.count({ where }),
    db.delivery.findMany({ where, include: { reservation: { select: { reference: true, id: true } }, lender: { select: { companyName: true } } }, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
  ]);
  return { rows, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}
