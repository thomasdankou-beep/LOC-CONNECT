import { describe, expect, it } from "vitest";
import { aggregateStatus, assertTransition, canTransition } from "@/lib/state-machine";
import { computeTotals, priceLine, refundPercentFor, type LenderDeliveryTerms } from "@/services/pricing";
import { applyBps, prorate } from "@/lib/money";
import { daysBetween, overlaps, parseDate } from "@/lib/dates";
import { computeReturnAmounts, validateReturnQuantities } from "@/services/returns";
import { planCancellation } from "@/services/refunds";

describe("machine à états", () => {
  it("autorise le parcours nominal", () => {
    const path = ["HOLD", "PENDING_PAYMENT", "PAID", "CONFIRMED", "READY", "IN_USE", "RETURNED", "COMPLETED"] as const;
    for (let i = 0; i < path.length - 1; i++) expect(canTransition(path[i], path[i + 1])).toBe(true);
  });

  it("refuse les transitions impossibles", () => {
    expect(canTransition("COMPLETED", "IN_USE")).toBe(false);
    expect(canTransition("CONFIRMED", "COMPLETED")).toBe(false);
    expect(() => assertTransition("READY", "PAID")).toThrowError(/Transition impossible/);
  });

  it("dérive le statut global : un litige ciblé n'affecte pas les autres lignes", () => {
    expect(aggregateStatus(["IN_USE", "DISPUTED"])).toBe("IN_USE");
    expect(aggregateStatus(["DISPUTED", "DISPUTED"])).toBe("DISPUTED");
    expect(aggregateStatus(["COMPLETED", "READY"])).toBe("READY");
    expect(aggregateStatus(["CANCELLED", "COMPLETED"])).toBe("COMPLETED");
    expect(aggregateStatus(["CANCELLED", "REFUNDED"])).toBe("REFUNDED");
    expect(aggregateStatus(["CANCELLED", "CANCELLED"])).toBe("CANCELLED");
  });
});

describe("dates et chevauchement", () => {
  it("applique la règle début < fin existante ET fin > début existant", () => {
    const d = (s: string) => parseDate(s);
    expect(overlaps(d("2026-01-01"), d("2026-01-05"), d("2026-01-04"), d("2026-01-08"))).toBe(true);
    expect(overlaps(d("2026-01-01"), d("2026-01-05"), d("2026-01-05"), d("2026-01-08"))).toBe(false);
    expect(overlaps(d("2026-01-05"), d("2026-01-08"), d("2026-01-01"), d("2026-01-05"))).toBe(false);
    expect(daysBetween(d("2026-01-01"), d("2026-01-04"))).toBe(3);
  });

  it("rejette les dates invalides", () => {
    expect(() => parseDate("2026-02-30")).toThrow();
    expect(() => parseDate("31/01/2026")).toThrow();
  });
});

describe("tarification", () => {
  const terms = (id: string, cityId: string): LenderDeliveryTerms => ({ lenderId: id, cityId, offersDelivery: true, feeLocal: 3000, feeRemote: 8000, commissionRateBps: 1000 });

  it("calcule sous-total, commission et caution par ligne", () => {
    const line = priceLine({ productId: "p", lenderId: "l", quantity: 50, start: parseDate("2026-05-01"), end: parseDate("2026-05-04"), unitPrice: 1000, depositAmount: 2000, refundPrice: 5000, commissionRateBps: 1000 });
    expect(line.days).toBe(3);
    expect(line.subtotal).toBe(150_000);
    expect(line.commission).toBe(15_000);
    expect(line.deposit).toBe(100_000);
  });

  it("répartit un panier multi-loueurs avec livraison par loueur", () => {
    const a = priceLine({ productId: "p1", lenderId: "A", quantity: 10, start: parseDate("2026-05-01"), end: parseDate("2026-05-02"), unitPrice: 1000, depositAmount: 500, refundPrice: 1000, commissionRateBps: 1000 });
    const b = priceLine({ productId: "p2", lenderId: "B", quantity: 1, start: parseDate("2026-05-01"), end: parseDate("2026-05-03"), unitPrice: 80_000, depositAmount: 300_000, refundPrice: 400_000, commissionRateBps: 1000 });
    const t = computeTotals([a, b], new Map([["A", terms("A", "abj")], ["B", terms("B", "bke")]]), "DELIVERY", "abj", false);
    expect(t.byLender.find((l) => l.lenderId === "A")!.delivery).toBe(3000);
    expect(t.byLender.find((l) => l.lenderId === "B")!.delivery).toBe(8000);
    expect(t.subtotal).toBe(10_000 + 160_000);
    expect(t.total).toBe(t.subtotal + 11_000 + 5000 + 300_000);
    expect(t.commissionTotal).toBe(1000 + 16_000);
  });

  it("arrondit sans virgule flottante", () => {
    expect(applyBps(333, 1000)).toBe(33);
    expect(prorate(1001, 50, 100)).toBe(501);
  });

  it("choisit la règle d'annulation selon le délai", () => {
    const rules = [{ minHoursBefore: 72, refundPercent: 100 }, { minHoursBefore: 24, refundPercent: 50 }, { minHoursBefore: 0, refundPercent: 0 }];
    expect(refundPercentFor(rules, 100)).toBe(100);
    expect(refundPercentFor(rules, 72)).toBe(100);
    expect(refundPercentFor(rules, 30)).toBe(50);
    expect(refundPercentFor(rules, 5)).toBe(0);
  });
});

describe("retour et caution", () => {
  it("plafonne la retenue par la caution et facture le complément si autorisé", () => {
    const r = computeReturnAmounts({ quantity: 10, lostQuantity: 2, damagedQuantity: 1, damageAmount: 3000, refundPrice: 5000, depositAmount: 8000, allowsExtraBilling: true });
    expect(r.lostAmount).toBe(10_000);
    expect(r.totalDamage).toBe(13_000);
    expect(r.withheld).toBe(8000);
    expect(r.extraCharge).toBe(5000);
  });

  it("laisse la perte au-delà de la caution au loueur si le produit ne l'autorise pas", () => {
    const r = computeReturnAmounts({ quantity: 10, lostQuantity: 2, damagedQuantity: 0, damageAmount: 0, refundPrice: 5000, depositAmount: 8000, allowsExtraBilling: false });
    expect(r.withheld).toBe(8000);
    expect(r.extraCharge).toBe(0);
  });

  it("valide les quantités du constat", () => {
    expect(() => validateReturnQuantities(10, { returnedQuantity: 8, lostQuantity: 2, damagedQuantity: 3 })).not.toThrow();
    expect(() => validateReturnQuantities(10, { returnedQuantity: 8, lostQuantity: 1, damagedQuantity: 0 })).toThrow();
    expect(() => validateReturnQuantities(10, { returnedQuantity: 8, lostQuantity: 2, damagedQuantity: 9 })).toThrow();
  });
});

describe("plan d'annulation", () => {
  const item = (over: object = {}) => ({ id: "i1", reservationId: "r", productId: "p", lenderId: "L", productName: "Tente", quantity: 1, startDate: parseDate("2026-06-10"), endDate: parseDate("2026-06-12"), days: 2, unitPrice: 50_000, subtotal: 100_000, commissionRateBps: 1000, commission: 10_000, paymentMode: "ONLINE_FULL" as "ONLINE_FULL" | "DEPOSIT_CASH", cashDue: 0, depositAmount: 80_000, depositPercent: null as number | null, refundPrice: 1, allowsExtraBilling: true, status: "CONFIRMED" as const, cancelledAt: null, refundedRental: 0, createdAt: new Date(), updatedAt: new Date(), deposit: { id: "d", itemId: "i1", amount: 80_000, withheldAmount: 0, releasedAmount: 0, status: "HELD" as const, mode: "COLLECTED", heldAt: null, settledAt: null, releaseDueDate: null, frozen: false, reason: null, paymentId: null, createdAt: new Date(), updatedAt: new Date() }, ...over });
  const rules = [{ minHoursBefore: 72, refundPercent: 100 }, { minHoursBefore: 24, refundPercent: 50 }, { minHoursBefore: 0, refundPercent: 0 }];

  it("rembourse selon la politique, commission au prorata, caution intégrale", () => {
    const plan = planCancellation({ items: [item()], allItems: [{ id: "i1", lenderId: "L", status: "CONFIRMED", commission: 10_000 }], deliveries: [], allocations: [], rules, policyName: "std", settings: { "commission.refund_policy": "PROPORTIONAL" }, now: parseDate("2026-06-01") });
    expect(plan.lines[0].percent).toBe(100);
    expect(plan.lines[0].rentalRefund).toBe(100_000);
    expect(plan.lines[0].lenderDeduction).toBe(90_000);
    expect(plan.depositTotal).toBe(80_000);
    expect(plan.clientTotal).toBe(180_000);
  });

  it("applique 50 % dans la fenêtre intermédiaire et garde la commission si non remboursable", () => {
    const plan = planCancellation({ items: [item()], allItems: [{ id: "i1", lenderId: "L", status: "CONFIRMED", commission: 10_000 }], deliveries: [], allocations: [], rules, policyName: "std", settings: { "commission.refund_policy": "NON_REFUNDABLE" }, now: parseDate("2026-06-08") });
    expect(plan.lines[0].percent).toBe(50);
    expect(plan.lines[0].rentalRefund).toBe(50_000);
    expect(plan.lines[0].commissionRefund).toBe(0);
    expect(plan.lines[0].lenderDeduction).toBe(50_000);
  });

  it("en mode espèces, ne rembourse que l'acompte payé en ligne et annule le solde dû", () => {
    const plan = planCancellation({ items: [item({ paymentMode: "DEPOSIT_CASH", cashDue: 90_000 })], allItems: [{ id: "i1", lenderId: "L", status: "CONFIRMED", commission: 10_000 }], deliveries: [], allocations: [], rules, policyName: "std", settings: { "commission.refund_policy": "PROPORTIONAL" }, now: parseDate("2026-06-01") });
    expect(plan.lines[0].rentalRefund).toBe(10_000);
    expect(plan.lines[0].lenderDeduction).toBe(0);
    expect(plan.cashCancelled).toBe(90_000);
    expect(plan.clientTotal).toBe(90_000); // acompte 10 000 + caution 80 000
  });

  it("rembourse la livraison seulement si toutes les lignes du loueur sont annulées", () => {
    const base = { items: [item()], deliveries: [{ lenderId: "L", fee: 3000 }], allocations: [{ lenderId: "L", commissionAmount: 10_000 }], rules, policyName: "std", settings: { "commission.refund_policy": "PROPORTIONAL" as const }, now: parseDate("2026-06-01") };
    const all = planCancellation({ ...base, allItems: [{ id: "i1", lenderId: "L", status: "CONFIRMED", commission: 10_000 }] });
    expect(all.deliveryTotal).toBe(3000);
    const partial = planCancellation({ ...base, allItems: [{ id: "i1", lenderId: "L", status: "CONFIRMED", commission: 10_000 }, { id: "i2", lenderId: "L", status: "CONFIRMED", commission: 0 }] });
    expect(partial.deliveryTotal).toBe(0);
  });
});
