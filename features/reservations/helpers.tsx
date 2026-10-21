import type { ReactNode } from "react";
import type { ReservationStatus } from "@prisma/client";

/** Texte de la prochaine action attendue du client selon le statut (affiché dans les listes et le détail). */
export function nextActionForClient(status: ReservationStatus, ctx: { fulfillment: "PICKUP" | "DELIVERY"; extraChargePending?: boolean; contestable?: boolean }): ReactNode {
  if (ctx.extraChargePending) return "Un complément est à régler";
  if (ctx.contestable) return "Constat de retour à accepter ou contester";
  switch (status) {
    case "HOLD":
    case "PENDING_PAYMENT":
      return "Finaliser le paiement";
    case "PAID":
      return "En attente de confirmation du loueur";
    case "CONFIRMED":
      return "Le loueur prépare votre commande";
    case "READY":
      return ctx.fulfillment === "DELIVERY" ? "Livraison à venir" : "À retirer chez le loueur";
    case "DELIVERING":
      return "Livraison en route";
    case "DELIVERED":
    case "IN_USE":
      return "Location en cours, pensez à restituer à temps";
    case "RETURN_PENDING":
      return "Retour du matériel attendu";
    case "RETURNED":
      return "Constat de retour en cours";
    case "COMPLETED":
      return "Terminée, vous pouvez laisser un avis";
    case "DISPUTED":
      return "Litige en cours d'examen";
    case "CANCELLED":
    case "REFUNDED":
      return "Annulée";
    default:
      return "";
  }
}

export const RESERVATION_TABS = [
  { key: "all", label: "Toutes", statuses: undefined },
  { key: "upcoming", label: "À venir", statuses: ["PENDING_PAYMENT", "PAID", "CONFIRMED", "READY"] },
  { key: "active", label: "En cours", statuses: ["DELIVERING", "DELIVERED", "IN_USE", "RETURN_PENDING", "RETURNED", "DISPUTED"] },
  { key: "done", label: "Terminées", statuses: ["COMPLETED"] },
  { key: "cancelled", label: "Annulées", statuses: ["CANCELLED", "REFUNDED"] },
] as const;
