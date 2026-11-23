import { createHash } from "node:crypto";
import { AppError } from "@/lib/errors";
import type { PricedLine, Totals } from "./pricing";

export type TermsSnapshot = { lenderId: string; terms: string | null }[];

export function snapshotTerms(lenders: { id: string; terms: string | null }[]): TermsSnapshot {
  return [...new Map(lenders.map((l) => [l.id, { lenderId: l.id, terms: l.terms }])).values()].sort((a, b) => a.lenderId.localeCompare(b.lenderId));
}

export function termsVersion(terms: TermsSnapshot): string {
  const ordered = terms.map((t) => ({ lenderId: t.lenderId, terms: t.terms })).sort((a, b) => a.lenderId.localeCompare(b.lenderId));
  return createHash("sha256").update(JSON.stringify(ordered)).digest("hex");
}

export function readTermsSnapshot(value: unknown): TermsSnapshot | null {
  if (!Array.isArray(value) || !value.every((v) => v && typeof v.lenderId === "string" && (v.terms === null || typeof v.terms === "string"))) return null;
  return value as TermsSnapshot;
}

/** Empreinte des engagements financiers, indépendante de l'ordre de lecture des lignes en base. */
export function pricingFingerprint(priced: PricedLine[], totals: Totals, products: { productId: string; product: { allowsExtraBilling: boolean } }[]): string {
  const lines = priced.map((l) => ({
    productId: l.productId, lenderId: l.lenderId, quantity: l.quantity,
    start: l.start.toISOString(), end: l.end.toISOString(), unitPrice: l.unitPrice,
    subtotal: l.subtotal, refundPrice: l.refundPrice, deposit: l.deposit,
    depositPercent: l.depositPercent ?? null, depositFloorPercent: l.depositFloorPercent ?? null,
    commission: l.commission, commissionRateBps: l.commissionRateBps,
    paymentMode: l.paymentMode, cashDue: l.cashDue,
    allowsExtraBilling: products.find((p) => p.productId === l.productId)!.product.allowsExtraBilling,
  })).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  const byLender = [...totals.byLender].sort((a, b) => a.lenderId.localeCompare(b.lenderId));
  return createHash("sha256").update(JSON.stringify({ lines, byLender })).digest("hex");
}

export function assertQuotePricing(quote: { number: string; data: unknown; total: number; netToPay: number }, priced: PricedLine[], totals: Totals, products: Parameters<typeof pricingFingerprint>[2]): void {
  const expected = (quote.data as { pricingFingerprint?: string } | null)?.pricingFingerprint;
  if (!expected || expected !== pricingFingerprint(priced, totals, products) || quote.total !== totals.total || quote.netToPay !== totals.subtotal + totals.deliveryFee + totals.depositTotal) {
    throw new AppError("PRICE_CHANGED", `Les conditions tarifaires de la proforma ${quote.number} doivent être actualisées. Demandez une nouvelle proforma depuis votre panier.`);
  }
}

export type QuotedDelivery = { pendingLenderIds: string[]; approvedFees: [string, number][] };

export function quoteDelivery(data: unknown): QuotedDelivery | undefined {
  return (data as { deliveryApproval?: QuotedDelivery } | null | undefined)?.deliveryApproval;
}

export function quoteDeliveryFees(data: unknown): Map<string, number> {
  const approval = quoteDelivery(data);
  if (approval?.pendingLenderIds.length) throw new AppError("CONFLICT", "Le tarif de livraison doit encore être confirmé par les loueurs.");
  return new Map(approval?.approvedFees);
}
