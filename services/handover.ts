import type { ReservationStatus } from "@prisma/client";
import type { z } from "zod";
import { audit } from "@/lib/audit";
import { can, type Actor } from "@/lib/auth/actor";
import { lockReservation, transaction } from "@/lib/db";
import { AppError, forbidden, notFound } from "@/lib/errors";
import { fulfillmentFor } from "@/lib/fulfillment";
import { handoverInput, readHandover } from "@/lib/material-check";

export function canRecordHandover(actor: Actor, mode: "PICKUP" | "DELIVERY", status: ReservationStatus) {
  if (actor.accountType !== "LENDER" || !can(actor, "ORDER_VIEW")) return false;
  return mode === "PICKUP"
    ? can(actor, "ORDER_STATUS_UPDATE") && ["READY", "IN_USE"].includes(status)
    : can(actor, "DELIVERY_UPDATE") && ["DELIVERING", "DELIVERED", "IN_USE"].includes(status);
}

export async function recordHandover(actor: Actor & { lenderId: string }, itemId: string, rawInput: z.infer<typeof handoverInput>) {
  const input = handoverInput.parse(rawInput);
  return transaction(async (tx) => {
    const where = { id: itemId, lenderId: actor.lenderId };
    const identity = await tx.reservationItem.findFirst({ where, select: { reservationId: true } });
    if (!identity) throw notFound("Article de la réservation");
    await lockReservation(tx, identity.reservationId);
    const item = await tx.reservationItem.findFirst({ where, include: { reservation: true, returnReport: { select: { id: true } } } });
    if (!item) throw notFound("Article de la réservation");
    if (!canRecordHandover(actor, fulfillmentFor(item.reservation, actor.lenderId).mode, item.status) || item.returnReport) throw forbidden();
    if (input.quantity > item.quantity) throw new AppError("VALIDATION_ERROR", "La quantité remise ne peut pas dépasser la quantité réservée.");
    if ((input.quantity !== item.quantity || input.condition === "WITH_RESERVATIONS") && !input.notes) {
      throw new AppError("VALIDATION_ERROR", "Décrivez l’écart de quantité ou les réserves.");
    }
    if (readHandover(item.handoverCheck)?.signature && !input.signature) {
      throw new AppError("VALIDATION_ERROR", "Faites signer à nouveau la fiche de remise corrigée.");
    }
    const handoverCheck = { ...input, recordedAt: new Date().toISOString() };
    await tx.reservationItem.update({ where: { id: itemId }, data: { handoverCheck } });
    await audit(tx, { userId: actor.userId, lenderId: actor.lenderId, action: "handover.record", entity: "ReservationItem", entityId: itemId, oldValue: item.handoverCheck ?? undefined, newValue: handoverCheck, meta: actor.meta });
    return handoverCheck;
  });
}
