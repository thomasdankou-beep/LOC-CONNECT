import type { ReservationStatus } from "@prisma/client";
import { AppError } from "./errors";

/**
 * Machine à états d'une ligne de réservation (un loueur, un produit, une période).
 * Le statut global de la réservation est dérivé des lignes (voir aggregateStatus).
 * Les transitions impossibles sont refusées côté serveur.
 */
export const ITEM_TRANSITIONS: Record<ReservationStatus, ReservationStatus[]> = {
  DRAFT: ["HOLD", "CANCELLED"],
  HOLD: ["PENDING_PAYMENT", "CANCELLED"],
  PENDING_PAYMENT: ["PAID", "HOLD", "CANCELLED"],
  PAID: ["CONFIRMED", "CANCELLED", "REFUNDED"],
  CONFIRMED: ["READY", "CANCELLED", "REFUNDED"],
  READY: ["DELIVERING", "IN_USE", "CANCELLED", "REFUNDED"],
  DELIVERING: ["DELIVERED", "READY"],
  DELIVERED: ["IN_USE", "RETURN_PENDING", "DISPUTED"],
  IN_USE: ["RETURN_PENDING", "RETURNED", "DISPUTED"],
  RETURN_PENDING: ["RETURNED", "DISPUTED"],
  RETURNED: ["COMPLETED", "DISPUTED"],
  COMPLETED: ["DISPUTED"],
  CANCELLED: ["REFUNDED"],
  REFUNDED: [],
  DISPUTED: ["DELIVERED", "IN_USE", "RETURN_PENDING", "RETURNED", "COMPLETED", "CANCELLED", "REFUNDED"],
};

/** Statuts qui bloquent du stock pour la période de la ligne. */
export const OCCUPYING_STATUSES: ReservationStatus[] = [
  "PAID",
  "CONFIRMED",
  "READY",
  "DELIVERING",
  "DELIVERED",
  "IN_USE",
  "RETURN_PENDING",
  "DISPUTED",
];

/** Statuts à partir desquels la ligne est annulable par le client. */
export const CANCELLABLE_STATUSES: ReservationStatus[] = ["PAID", "CONFIRMED", "READY"];

/** Statuts pour lesquels un litige peut être ouvert. */
export const DISPUTABLE_STATUSES: ReservationStatus[] = ["DELIVERED", "IN_USE", "RETURN_PENDING", "RETURNED", "COMPLETED"];

export const TERMINAL_STATUSES: ReservationStatus[] = ["COMPLETED", "CANCELLED", "REFUNDED"];

export function canTransition(from: ReservationStatus, to: ReservationStatus): boolean {
  return ITEM_TRANSITIONS[from].includes(to);
}

export function assertTransition(from: ReservationStatus, to: ReservationStatus): void {
  if (!canTransition(from, to)) {
    throw new AppError("INVALID_TRANSITION", `Transition impossible : ${from} vers ${to}.`, { from, to });
  }
}

const PROGRESS: ReservationStatus[] = [
  "DRAFT",
  "HOLD",
  "PENDING_PAYMENT",
  "PAID",
  "CONFIRMED",
  "READY",
  "DELIVERING",
  "DELIVERED",
  "IN_USE",
  "RETURN_PENDING",
  "RETURNED",
  "COMPLETED",
];

/**
 * Statut global dérivé des lignes. Un litige ciblé sur une ligne ne fait pas basculer les autres lignes :
 * le statut global reste celui de la ligne la moins avancée, et DISPUTED seulement si toutes les lignes actives le sont.
 */
export function aggregateStatus(statuses: ReservationStatus[]): ReservationStatus {
  if (statuses.length === 0) return "DRAFT";
  const active = statuses.filter((s) => s !== "CANCELLED" && s !== "REFUNDED");
  if (active.length === 0) return statuses.some((s) => s === "REFUNDED") ? "REFUNDED" : "CANCELLED";
  if (active.every((s) => s === "DISPUTED")) return "DISPUTED";
  const ranked = active.filter((s) => s !== "DISPUTED").map((s) => PROGRESS.indexOf(s));
  return PROGRESS[Math.min(...ranked)];
}
