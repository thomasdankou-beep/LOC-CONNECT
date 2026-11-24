import type { Actor } from "@/lib/auth/actor";
import { fulfillmentFor } from "@/lib/fulfillment";
import type { ReservationDetail } from "@/services/reservations";

export type OperationalKind = "preparation" | "remise" | "retour";

export function operationalDocuments(actor: Actor, reservation: ReservationDetail, lenderId: string) {
  const items = reservation.items.filter((item) =>
    item.lenderId === lenderId && !["DRAFT", "HOLD", "PENDING_PAYMENT", "CANCELLED", "REFUNDED"].includes(item.status),
  );
  if (!items.length) return;

  const plan = fulfillmentFor(reservation, lenderId);
  const pickup = plan.mode === "PICKUP";
  const titles: Partial<Record<OperationalKind, string>> = {};
  if (actor.accountType !== "CLIENT") titles.preparation = "Bon de préparation";
  titles.remise = pickup ? "Bon de retrait au dépôt" : "Bon de livraison";
  if (items.some((item) => item.returnReport)) titles.retour = pickup ? "Bon de retour au dépôt" : "Bon de récupération";
  return { items, titles, pickup, plan };
}
