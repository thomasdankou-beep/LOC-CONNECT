import { z } from "zod";
import type { FulfillmentType } from "@prisma/client";

/** Tranches horaires proposées pour la remise et la récupération du matériel. */
export const SLOTS = ["08:00-10:00", "10:00-12:00", "12:00-14:00", "14:00-16:00", "16:00-18:00", "18:00-20:00"] as const;
export type Slot = (typeof SLOTS)[number];

export const slotInput = z.enum(SLOTS);

/** 14:00-16:00 devient 14h-16h. */
export function slotLabel(slot: string | null | undefined): string | null {
  if (!slot) return null;
  return slot.replace(/:00/g, "h").replace(/:(\d{2})/g, "h$1");
}

export function splitSlot(slot: string | null | undefined): { start: string; end: string } | null {
  if (!slot) return null;
  const [start, end] = slot.split("-");
  return start && end ? { start, end } : null;
}

/** Libellés des deux moments de la location selon le mode de remise. */
export const SCHEDULE_LABELS: Record<FulfillmentType, { out: string; back: string }> = {
  DELIVERY: { out: "Livraison", back: "Récupération" },
  PICKUP: { out: "Retrait chez le loueur", back: "Retour chez le loueur" },
};

/** « Livraison 14h-16h · Récupération 08h-10h », ou null sans créneau choisi. */
export function slotSummary(fulfillment: FulfillmentType, deliverySlot: string | null, returnSlot: string | null): string | null {
  const l = SCHEDULE_LABELS[fulfillment];
  const parts = [deliverySlot ? `${l.out} ${slotLabel(deliverySlot)}` : null, returnSlot ? `${l.back} ${slotLabel(returnSlot)}` : null].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}
