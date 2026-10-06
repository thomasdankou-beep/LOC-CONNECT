import type {
  BalanceEntryKind,
  CashSettlementStatus,
  LenderPaymentMode,
  DeliveryStatus,
  DepositStatus,
  DisputeStatus,
  FulfillmentType,
  LenderStatus,
  ModificationStatus,
  PaymentMethod,
  PaymentStatus,
  PayoutStatus,
  ProductStatus,
  RecoveryStatus,
  RefundStatus,
  ReservationStatus,
  ReturnCondition,
  ReturnReportStatus,
  ExtraChargeStatus,
  UserStatus,
} from "@prisma/client";

export type Tone = "neutral" | "info" | "success" | "warning" | "danger";

type Entry = { label: string; tone: Tone };

export const RESERVATION_STATUS: Record<ReservationStatus, Entry> = {
  DRAFT: { label: "Brouillon", tone: "neutral" },
  HOLD: { label: "Stock bloqué", tone: "info" },
  PENDING_PAYMENT: { label: "Paiement en attente", tone: "warning" },
  PAID: { label: "Payée", tone: "info" },
  CONFIRMED: { label: "Confirmée", tone: "success" },
  READY: { label: "Prête", tone: "success" },
  DELIVERING: { label: "En livraison", tone: "info" },
  DELIVERED: { label: "Livrée", tone: "info" },
  IN_USE: { label: "En cours", tone: "info" },
  RETURN_PENDING: { label: "Retour attendu", tone: "warning" },
  RETURNED: { label: "Retournée", tone: "info" },
  COMPLETED: { label: "Terminée", tone: "success" },
  CANCELLED: { label: "Annulée", tone: "neutral" },
  REFUNDED: { label: "Remboursée", tone: "neutral" },
  DISPUTED: { label: "En litige", tone: "danger" },
};

export const PAYMENT_STATUS: Record<PaymentStatus, Entry> = {
  PENDING: { label: "En attente", tone: "warning" },
  PAID: { label: "Payé", tone: "success" },
  FAILED: { label: "Échoué", tone: "danger" },
  CANCELLED: { label: "Annulé", tone: "neutral" },
  PARTIALLY_REFUNDED: { label: "Partiellement remboursé", tone: "info" },
  REFUNDED: { label: "Remboursé", tone: "neutral" },
};

export const PAYMENT_METHOD: Record<PaymentMethod, string> = {
  ORANGE_MONEY: "Orange Money",
  MTN_MONEY: "MTN Money",
  MOOV_MONEY: "Moov Money",
  WAVE: "Wave",
  CARD: "Carte bancaire",
};

export const DEPOSIT_STATUS: Record<DepositStatus, Entry> = {
  PENDING: { label: "À bloquer", tone: "neutral" },
  HELD: { label: "Bloquée", tone: "info" },
  RELEASED: { label: "Libérée", tone: "success" },
  PARTIALLY_WITHHELD: { label: "Retenue partielle", tone: "warning" },
  FULLY_WITHHELD: { label: "Retenue totale", tone: "danger" },
};

export const DELIVERY_STATUS: Record<DeliveryStatus, Entry> = {
  PENDING: { label: "À planifier", tone: "neutral" },
  PREPARING: { label: "En préparation", tone: "info" },
  OUT_FOR_DELIVERY: { label: "En route", tone: "info" },
  DELIVERED: { label: "Livrée", tone: "success" },
  FAILED: { label: "Échec", tone: "danger" },
  RETURNED: { label: "Récupérée", tone: "neutral" },
};

export const DISPUTE_STATUS: Record<DisputeStatus, Entry> = {
  OPEN: { label: "Ouvert", tone: "danger" },
  UNDER_REVIEW: { label: "En examen", tone: "warning" },
  WAITING_RESPONSE: { label: "En attente de réponse", tone: "warning" },
  RESOLVED: { label: "Résolu", tone: "success" },
  REJECTED: { label: "Rejeté", tone: "neutral" },
  CLOSED: { label: "Clos", tone: "neutral" },
};

export const PRODUCT_STATUS: Record<ProductStatus, Entry> = {
  DRAFT: { label: "Brouillon", tone: "neutral" },
  PENDING_REVIEW: { label: "En modération", tone: "warning" },
  PUBLISHED: { label: "Publié", tone: "success" },
  REJECTED: { label: "Refusé", tone: "danger" },
  INACTIVE: { label: "Désactivé", tone: "neutral" },
};

export const LENDER_STATUS: Record<LenderStatus, Entry> = {
  PENDING: { label: "En attente de validation", tone: "warning" },
  APPROVED: { label: "Validé", tone: "success" },
  REJECTED: { label: "Rejeté", tone: "danger" },
  SUSPENDED: { label: "Suspendu", tone: "danger" },
};

export const USER_STATUS: Record<UserStatus, Entry> = {
  ACTIVE: { label: "Actif", tone: "success" },
  SUSPENDED: { label: "Suspendu", tone: "danger" },
  DEACTIVATED: { label: "Désactivé", tone: "neutral" },
};

export const PAYOUT_STATUS: Record<PayoutStatus, Entry> = {
  PENDING: { label: "En cours", tone: "warning" },
  PAID: { label: "Versé", tone: "success" },
  FAILED: { label: "Échoué", tone: "danger" },
};

export const REFUND_STATUS: Record<RefundStatus, Entry> = {
  PENDING: { label: "En cours", tone: "warning" },
  COMPLETED: { label: "Remboursé", tone: "success" },
  FAILED: { label: "Échoué", tone: "danger" },
};

export const RECOVERY_STATUS: Record<RecoveryStatus, Entry> = {
  NOT_NEEDED: { label: "Non nécessaire", tone: "neutral" },
  TO_RECOVER: { label: "À recouvrer", tone: "danger" },
  RECOVERED: { label: "Recouvré", tone: "success" },
  OFFSET: { label: "Compensé", tone: "success" },
};

export const MODIFICATION_STATUS: Record<ModificationStatus, Entry> = {
  REQUESTED: { label: "Demandée", tone: "neutral" },
  PENDING_VALIDATION: { label: "En attente de validation", tone: "warning" },
  ACCEPTED: { label: "Acceptée", tone: "info" },
  PENDING_PAYMENT: { label: "Paiement en attente", tone: "warning" },
  PAID: { label: "Payée", tone: "info" },
  APPLIED: { label: "Appliquée", tone: "success" },
  REJECTED: { label: "Refusée", tone: "danger" },
  EXPIRED: { label: "Expirée", tone: "neutral" },
  CANCELLED: { label: "Annulée", tone: "neutral" },
};

export const RETURN_REPORT_STATUS: Record<ReturnReportStatus, Entry> = {
  SUBMITTED: { label: "En fenêtre de contestation", tone: "warning" },
  CONTESTED: { label: "Contesté", tone: "danger" },
  VALIDATED: { label: "Validé", tone: "success" },
  RESOLVED: { label: "Résolu", tone: "success" },
};

export const EXTRA_CHARGE_STATUS: Record<ExtraChargeStatus, Entry> = {
  PENDING: { label: "À payer", tone: "warning" },
  PAID: { label: "Payé", tone: "success" },
  WAIVED: { label: "Annulé", tone: "neutral" },
  CANCELLED: { label: "Annulé", tone: "neutral" },
};

export const RETURN_CONDITION: Record<ReturnCondition, string> = {
  EXCELLENT: "Excellent état",
  GOOD: "Bon état",
  FAIR: "Usure normale",
  DAMAGED: "Endommagé",
  LOST: "Perdu",
};

export const FULFILLMENT: Record<FulfillmentType, string> = { PICKUP: "Retrait chez le loueur", DELIVERY: "Livraison" };

export const BALANCE_KIND: Record<BalanceEntryKind, string> = {
  SALE: "Location (part nette)",
  DELIVERY_FEE: "Frais de livraison",
  DEPOSIT_CAPTURE: "Retenue sur caution",
  REFUND_DEDUCTION: "Remboursement client à compenser",
  RECOVERY_OFFSET: "Compensation de recouvrement",
  MANUAL_RECOVERY: "Recouvrement manuel",
  PAYOUT_ADJUSTMENT: "Ajustement de versement",
};

export const PAYOUT_METHOD: Record<string, string> = {
  BANK_TRANSFER: "Virement bancaire",
  ORANGE_MONEY: "Orange Money",
  MTN_MONEY: "MTN Money",
  MOOV_MONEY: "Moov Money",
  WAVE: "Wave",
};

export const PAYMENT_MODE: Record<LenderPaymentMode, { label: string; short: string; description: string }> = {
  ONLINE_FULL: { label: "Paiement 100 % en ligne", short: "100 % en ligne", description: "Le client paie tout en ligne. Paiement protégé par LOC'CONNECT jusqu'au retour du matériel." },
  DEPOSIT_CASH: { label: "Acompte en ligne + solde en espèces", short: "Acompte + espèces", description: "Le client paie en ligne un acompte et la caution, puis le solde en espèces au loueur à la remise du matériel." },
};

export const CASH_STATUS: Record<CashSettlementStatus, Entry> = {
  PENDING: { label: "À payer à la remise", tone: "warning" },
  PAID: { label: "Payé en espèces", tone: "success" },
  UNPAID: { label: "Signalé impayé", tone: "danger" },
  CANCELLED: { label: "Annulé", tone: "neutral" },
};
