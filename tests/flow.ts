import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import type { Actor } from "@/lib/auth/actor";
import { addToCart } from "@/services/cart";
import { createHold } from "@/services/holds";
import { createReservationFromHold } from "@/services/reservations";
import { initiatePayment, simulatePayment } from "@/services/payments";
import { day } from "./helpers";

type Line = { productId: string; quantity: number; start: number; end: number };

/** Parcours complet : panier, HOLD, réservation, paiement simulé confirmé par webhook signé. */
export async function bookAndPay(client: { user: { id: string }; actor: Actor }, lines: Line[], opts: { delivery?: boolean; cityId?: string; pay?: boolean } = {}) {
  for (const l of lines) await addToCart(client.user.id, { productId: l.productId, quantity: l.quantity, startDate: day(l.start), endDate: day(l.end) });
  const hold = await createHold(client.user.id, {
    fulfillmentType: opts.delivery ? "DELIVERY" : "PICKUP",
    deliveryAddress: opts.delivery ? "Rue des Jardins, Cocody" : undefined,
    deliveryCityId: opts.cityId,
    replaceExisting: true,
  });
  const reservation = await createReservationFromHold(client.user.id, hold.id);
  const { payment } = await initiatePayment(client.actor, { reservationId: reservation.id, method: "WAVE", idempotencyKey: randomUUID() });
  if (opts.pay !== false) await simulatePayment(client.actor, payment.id, "success");
  return { hold, reservation: await db.reservation.findUniqueOrThrow({ where: { id: reservation.id }, include: { items: true } }), payment: await db.payment.findUniqueOrThrow({ where: { id: payment.id } }) };
}
