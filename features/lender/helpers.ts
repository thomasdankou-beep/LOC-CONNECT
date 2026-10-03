import type { ReservationStatus } from "@prisma/client";

export type LenderTarget = "CONFIRMED" | "READY" | "IN_USE";

/** Prochaine action du loueur pour une ligne selon son statut (les permissions sont revérifiées côté serveur). */
export function nextLenderTarget(status: ReservationStatus, fulfillment: "PICKUP" | "DELIVERY", perms: { validate: boolean; prepare: boolean; handover: boolean }): LenderTarget | null {
  if (status === "PAID" && perms.validate) return "CONFIRMED";
  if (status === "CONFIRMED" && perms.prepare) return "READY";
  if (status === "READY" && fulfillment === "PICKUP" && perms.handover) return "IN_USE";
  return null;
}
