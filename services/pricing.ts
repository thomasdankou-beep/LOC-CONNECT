import { applyBps, sum } from "@/lib/money";
import { daysBetween } from "@/lib/dates";
import type { FulfillmentType, LenderPaymentMode } from "@prisma/client";

/**
 * Mode de paiement réellement appliqué à un loueur : le mode espèces exige l'option globale et l'autorisation de l'administration.
 * Le mode est ensuite figé sur chaque ligne de réservation : un changement ultérieur n'affecte pas les commandes en cours.
 */
export function effectivePaymentMode(
  lender: { paymentMode: LenderPaymentMode; cashModeAllowed: boolean },
  settings: { "cash.enabled": boolean },
): LenderPaymentMode {
  return settings["cash.enabled"] && lender.cashModeAllowed && lender.paymentMode === "DEPOSIT_CASH" ? "DEPOSIT_CASH" : "ONLINE_FULL";
}

/**
 * Part de la location payée en ligne. En mode espèces : un acompte égal à la commission, avec un minimum,
 * jamais plus que la location elle-même. Le reste est réglé en espèces au loueur.
 */
export function onlineRentalFor(subtotal: number, commission: number, mode: LenderPaymentMode, minDeposit: number): number {
  if (mode !== "DEPOSIT_CASH") return subtotal;
  return Math.min(subtotal, Math.max(commission, minDeposit));
}

export type PricingInput = {
  productId: string;
  lenderId: string;
  quantity: number;
  start: Date;
  end: Date;
  unitPrice: number;
  depositAmount: number;
  refundPrice: number;
  commissionRateBps: number;
  paymentMode?: LenderPaymentMode;
  minCashDeposit?: number;
};

export type PricedLine = PricingInput & {
  days: number;
  subtotal: number;
  commission: number;
  deposit: number;
  paymentMode: LenderPaymentMode;
  /** Part de la location réglée en espèces au loueur. */
  cashDue: number;
};

/** Calcul d'une ligne. Toujours exécuté côté serveur : le navigateur n'est jamais une source de vérité. */
export function priceLine(input: PricingInput): PricedLine {
  const days = daysBetween(input.start, input.end);
  const subtotal = input.unitPrice * input.quantity * days;
  const commission = applyBps(subtotal, input.commissionRateBps);
  const paymentMode = input.paymentMode ?? "ONLINE_FULL";
  return {
    ...input,
    days,
    subtotal,
    commission,
    deposit: input.depositAmount * input.quantity,
    paymentMode,
    cashDue: subtotal - onlineRentalFor(subtotal, commission, paymentMode, input.minCashDeposit ?? 0),
  };
}

export type LenderDeliveryTerms = {
  lenderId: string;
  cityId: string;
  offersDelivery: boolean;
  feeLocal: number;
  feeRemote: number;
  commissionRateBps: number;
  paymentMode?: LenderPaymentMode;
};

export function deliveryFeeFor(terms: LenderDeliveryTerms, fulfillment: FulfillmentType, addressCityId: string | null | undefined): number {
  if (fulfillment !== "DELIVERY") return 0;
  return addressCityId && addressCityId === terms.cityId ? terms.feeLocal : terms.feeRemote;
}

export type LenderBreakdown = {
  lenderId: string;
  rental: number;
  delivery: number;
  commission: number;
  net: number;
  deposit: number;
  paymentMode: LenderPaymentMode;
  /** Location et livraison réglées en espèces au loueur. */
  cash: number;
  cashDelivery: number;
  /** Montant payé en ligne pour ce loueur (caution comprise). */
  online: number;
};

export type Totals = {
  subtotal: number;
  deliveryFee: number;
  depositTotal: number;
  commissionTotal: number;
  cashTotal: number;
  /** Montant du paiement en ligne unique. */
  total: number;
  byLender: LenderBreakdown[];
};

export function computeTotals(
  lines: PricedLine[],
  terms: Map<string, LenderDeliveryTerms>,
  fulfillment: FulfillmentType,
  addressCityId: string | null | undefined,
  commissionOnDelivery: boolean,
): Totals {
  const lenderIds = [...new Set(lines.map((l) => l.lenderId))];
  const byLender: LenderBreakdown[] = lenderIds.map((lenderId) => {
    const mine = lines.filter((l) => l.lenderId === lenderId);
    const t = terms.get(lenderId);
    const delivery = t ? deliveryFeeFor(t, fulfillment, addressCityId) : 0;
    const rental = sum(mine.map((l) => l.subtotal));
    const deliveryCommission = commissionOnDelivery && t ? applyBps(delivery, t.commissionRateBps) : 0;
    const commission = sum(mine.map((l) => l.commission)) + deliveryCommission;
    const deposit = sum(mine.map((l) => l.deposit));
    const paymentMode = mine[0]?.paymentMode ?? "ONLINE_FULL";
    // En mode espèces, la livraison est réglée au loueur ; seule sa commission éventuelle est payée en ligne.
    const cashDelivery = paymentMode === "DEPOSIT_CASH" ? delivery - deliveryCommission : 0;
    const cash = sum(mine.map((l) => l.cashDue)) + cashDelivery;
    return { lenderId, rental, delivery, commission, net: rental + delivery - commission, deposit, paymentMode, cash, cashDelivery, online: rental + delivery + deposit - cash };
  });
  const subtotal = sum(byLender.map((b) => b.rental));
  const deliveryFee = sum(byLender.map((b) => b.delivery));
  const depositTotal = sum(byLender.map((b) => b.deposit));
  const commissionTotal = sum(byLender.map((b) => b.commission));
  const cashTotal = sum(byLender.map((b) => b.cash));
  return { subtotal, deliveryFee, depositTotal, commissionTotal, cashTotal, total: subtotal + deliveryFee + depositTotal - cashTotal, byLender };
}

/** Remboursement selon une politique : première règle dont le délai minimal avant le début est atteint. */
export function refundPercentFor(rules: { minHoursBefore: number; refundPercent: number }[], hoursBeforeStart: number): number {
  const ordered = [...rules].sort((a, b) => b.minHoursBefore - a.minHoursBefore);
  for (const rule of ordered) {
    if (hoursBeforeStart >= rule.minHoursBefore) return rule.refundPercent;
  }
  return 0;
}
