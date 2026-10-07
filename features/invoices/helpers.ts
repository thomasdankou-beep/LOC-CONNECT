import type { Actor } from "@/lib/auth/actor";

/** Page de réservation de l'acteur, pour le lien « Retour » des documents. */
export function reservationHref(actor: Actor, reservationId: string): string {
  if (actor.accountType === "LENDER") return `/loueur/reservations/${reservationId}`;
  if (actor.accountType === "ADMIN") return `/admin/reservations/${reservationId}`;
  return `/mes-reservations/${reservationId}`;
}

export function invoicesHref(actor: Actor): string {
  if (actor.accountType === "LENDER") return "/loueur/factures";
  if (actor.accountType === "ADMIN") return "/admin/factures";
  return "/mes-factures";
}
