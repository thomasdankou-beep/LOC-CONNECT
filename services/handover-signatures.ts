import { createHash } from "node:crypto";
import type { ReservationItem } from "@prisma/client";
import { z } from "zod";
import { audit } from "@/lib/audit";
import type { Actor } from "@/lib/auth/actor";
import { db, lockReservation, transaction } from "@/lib/db";
import { AppError, forbidden, notFound } from "@/lib/errors";
import { fulfillmentFor } from "@/lib/fulfillment";
import { readHandover } from "@/lib/material-check";
import { signatureInput } from "@/lib/signature";
import { canRecordHandover } from "./handover";

export const handoverSignatureInput = z.object({
  fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  signer: z.string().trim().min(1).max(120),
  strokes: signatureInput,
});

export function isOperationalItem(item: Pick<ReservationItem, "status">) {
  return !["DRAFT", "HOLD", "PENDING_PAYMENT", "CANCELLED", "REFUNDED"].includes(item.status);
}

type HandoverItem = Pick<ReservationItem, "id" | "status" | "productName" | "quantity" | "startDate" | "endDate" | "handoverCheck">;

export function handoverSnapshot(items: HandoverItem[]) {
  const checks = items.map((item) => {
    const check = readHandover(item.handoverCheck);
    if (!check || check.quantity > item.quantity) return null;
    const { signature: _legacySignature, ...details } = check;
    return {
      id: item.id, product: item.productName, plannedQuantity: item.quantity,
      start: item.startDate.toISOString(), end: item.endDate.toISOString(), ...details,
    };
  });
  if (!checks.length || checks.some((line) => line === null)) return;
  const lines = checks.filter((line) => line !== null).sort((a, b) => a.id.localeCompare(b.id));
  return { lines, fingerprint: createHash("sha256").update(JSON.stringify(lines)).digest("hex") };
}

export function findHandoverSignature(reservationId: string, lenderId: string, fingerprint: string) {
  return db.handoverSignature.findUnique({ where: { reservationId_lenderId_fingerprint: { reservationId, lenderId, fingerprint } } });
}

export async function signHandover(actor: Actor & { lenderId: string }, reservationId: string, rawInput: z.input<typeof handoverSignatureInput>) {
  const input = handoverSignatureInput.parse(rawInput);
  return transaction(async (tx) => {
    await lockReservation(tx, reservationId);
    const reservation = await tx.reservation.findUnique({
      where: { id: reservationId },
      include: { items: { where: { lenderId: actor.lenderId }, include: { returnReport: { select: { id: true } } } } },
    });
    if (!reservation?.items.length) throw notFound("Bon de remise");
    const items = reservation.items.filter(isOperationalItem);
    const plan = fulfillmentFor(reservation, actor.lenderId);
    if (!items.length || !items.every((item) => !item.returnReport && canRecordHandover(actor, plan.mode, item.status))) throw forbidden();
    const snapshot = handoverSnapshot(items);
    if (!snapshot || snapshot.fingerprint !== input.fingerprint) {
      throw new AppError("CONFLICT", "Le bon a changé. Actualisez la page et vérifiez les contrôles avant de signer.");
    }
    const key = { reservationId, lenderId: actor.lenderId, fingerprint: input.fingerprint };
    const existing = await tx.handoverSignature.findUnique({ where: { reservationId_lenderId_fingerprint: key } });
    if (existing) return existing;
    const signed = await tx.handoverSignature.create({
      data: { ...key, snapshot: snapshot.lines, signer: input.signer, strokes: input.strokes, recordedById: actor.userId },
    });
    await audit(tx, { userId: actor.userId, lenderId: actor.lenderId, action: "handover.sign", entity: "HandoverSignature", entityId: signed.id, newValue: { reservationId, fingerprint: input.fingerprint }, meta: actor.meta });
    return signed;
  });
}
