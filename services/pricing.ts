import { applyBps, sum } from "@/lib/money";
import { daysBetween } from "@/lib/dates";
import type { FulfillmentType } from "@prisma/client";

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
};

export type PricedLine = PricingInput & {
  days: number;
  subtotal: number;
  commission: number;
  deposit: number;
};

/** Calcul d'une ligne. Toujours exécuté côté serveur : le navigateur n'est jamais une source de vérité. */
export function priceLine(input: PricingInput): PricedLine {
  const days = daysBetween(input.start, input.end);
  const subtotal = input.unitPrice * input.quantity * days;
  return {
    ...input,
    days,
    subtotal,
    commission: applyBps(subtotal, input.commissionRateBps),
    deposit: input.depositAmount * input.quantity,
  };
}

export type LenderDeliveryTerms = {
  lenderId: string;
  cityId: string;
  offersDelivery: boolean;
  feeLocal: number;
  feeRemote: number;
  commissionRateBps: number;
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
};

export type Totals = {
  subtotal: number;
  deliveryFee: number;
  depositTotal: number;
  commissionTotal: number;
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
    const commission = sum(mine.map((l) => l.commission)) + (commissionOnDelivery && t ? applyBps(delivery, t.commissionRateBps) : 0);
    return { lenderId, rental, delivery, commission, net: rental + delivery - commission, deposit: sum(mine.map((l) => l.deposit)) };
  });
  const subtotal = sum(byLender.map((b) => b.rental));
  const deliveryFee = sum(byLender.map((b) => b.delivery));
  const depositTotal = sum(byLender.map((b) => b.deposit));
  const commissionTotal = sum(byLender.map((b) => b.commission));
  return { subtotal, deliveryFee, depositTotal, commissionTotal, total: subtotal + deliveryFee + depositTotal, byLender };
}

/** Remboursement selon une politique : première règle dont le délai minimal avant le début est atteint. */
export function refundPercentFor(rules: { minHoursBefore: number; refundPercent: number }[], hoursBeforeStart: number): number {
  const ordered = [...rules].sort((a, b) => b.minHoursBefore - a.minHoursBefore);
  for (const rule of ordered) {
    if (hoursBeforeStart >= rule.minHoursBefore) return rule.refundPercent;
  }
  return 0;
}
