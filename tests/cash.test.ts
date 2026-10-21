import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { lenderAdvance } from "@/services/reservations";
import { cancelReservation } from "@/services/refunds";
import { adminCashAction, confirmCashPayment, reportCashUnpaid } from "@/services/cash";
import { setPaymentMode } from "@/services/lenders";
import { setLenderCashMode, updateSetting } from "@/services/admin";
import { approveModification, payModification, requestModification } from "@/services/modifications";
import { simulatePayment } from "@/services/payments";
import { onlineRentalFor } from "@/services/pricing";
import { getCart } from "@/services/cart";
import { addToCart } from "@/services/cart";
import { bookAndPay } from "./flow";
import { day, makeAdmin, makeBase, makeClient, makeLender, makeProduct, resetDb } from "./helpers";

let base: Awaited<ReturnType<typeof makeBase>>;
beforeEach(async () => {
  await resetDb();
  base = await makeBase();
});

async function cashLender(name = "Loueur Espèces") {
  const l = await makeLender(base.city.id, { name });
  await db.lender.update({ where: { id: l.lender.id }, data: { cashModeAllowed: true, paymentMode: "DEPOSIT_CASH" } });
  return l;
}

/** Panier avec deux loueurs : A payé en ligne, B en acompte + espèces. */
async function mixed(opts: { start?: number; end?: number; delivery?: boolean } = {}) {
  const a = await makeLender(base.city.id, { name: "Loueur En Ligne" });
  const b = await cashLender();
  const pa = await makeProduct(a.lender.id, base.category.id, base.city.id, { unitPrice: 10_000, deposit: 5_000 });
  const pb = await makeProduct(b.lender.id, base.category.id, base.city.id, { unitPrice: 50_000, deposit: 30_000 });
  const client = await makeClient();
  const start = opts.start ?? 5;
  const end = opts.end ?? start + 2;
  const booked = await bookAndPay(client, [{ productId: pa.id, quantity: 1, start, end }, { productId: pb.id, quantity: 1, start, end }], { delivery: opts.delivery, cityId: base.city.id });
  const itemA = booked.reservation.items.find((i) => i.lenderId === a.lender.id)!;
  const itemB = booked.reservation.items.find((i) => i.lenderId === b.lender.id)!;
  return { a, b, client, booked, itemA, itemB, reservationId: booked.reservation.id };
}

const settlementOf = (reservationId: string, lenderId: string) => db.cashSettlement.findUniqueOrThrow({ where: { reservationId_lenderId: { reservationId, lenderId } } });

describe("acompte en ligne + solde en espèces", () => {
  it("calcule l'acompte : commission, minimum, jamais plus que la location", () => {
    expect(onlineRentalFor(100_000, 10_000, "DEPOSIT_CASH", 1000)).toBe(10_000);
    expect(onlineRentalFor(2_000, 200, "DEPOSIT_CASH", 1000)).toBe(1000);
    expect(onlineRentalFor(500, 50, "DEPOSIT_CASH", 1000)).toBe(500);
    expect(onlineRentalFor(100_000, 10_000, "ONLINE_FULL", 1000)).toBe(100_000);
  });

  it("facture mixte : un seul paiement en ligne, solde en espèces chez le loueur B seulement", async () => {
    const { a, b, booked, itemA, itemB, reservationId } = await mixed();
    // A : 20 000 + caution 5 000. B : acompte 10 000 (commission) + caution 30 000 ; 90 000 en espèces.
    expect(booked.payment.amount).toBe(65_000);
    expect(booked.payment.status).toBe("PAID");
    expect(booked.reservation.total).toBe(65_000);
    expect(booked.reservation.cashTotal).toBe(90_000);
    expect(itemA.paymentMode).toBe("ONLINE_FULL");
    expect(itemB.paymentMode).toBe("DEPOSIT_CASH");
    expect(itemB.cashDue).toBe(90_000);

    const allocB = await db.paymentAllocation.findFirstOrThrow({ where: { reservationId, lenderId: b.lender.id } });
    expect(allocB).toMatchObject({ rentalAmount: 10_000, commissionAmount: 10_000, netAmount: 0, depositAmount: 30_000, cashAmount: 90_000 });
    const allocA = await db.paymentAllocation.findFirstOrThrow({ where: { reservationId, lenderId: a.lender.id } });
    expect(allocA).toMatchObject({ rentalAmount: 20_000, netAmount: 18_000, cashAmount: 0 });

    // Le loueur B ne reçoit aucun versement pour cette location : il encaisse lui-même.
    expect(await db.balanceEntry.count({ where: { lenderId: b.lender.id } })).toBe(0);
    expect((await db.balanceEntry.findFirstOrThrow({ where: { lenderId: a.lender.id, kind: "SALE" } })).amount).toBe(18_000);

    const s = await settlementOf(reservationId, b.lender.id);
    expect(s).toMatchObject({ status: "PENDING", amountDue: 90_000 });
    expect(s.code).toMatch(/^\d{4}$/);
    expect(await db.cashSettlement.count({ where: { lenderId: a.lender.id } })).toBe(0);
  });

  it("acompte minimum : la part au-delà de la commission revient au loueur", async () => {
    const b = await cashLender();
    const p = await makeProduct(b.lender.id, base.category.id, base.city.id, { unitPrice: 2000, deposit: 0 });
    const client = await makeClient();
    const { reservation, payment } = await bookAndPay(client, [{ productId: p.id, quantity: 1, start: 3, end: 4 }]);
    expect(payment.amount).toBe(1000);
    expect(reservation.items[0].cashDue).toBe(1000);
    expect((await db.balanceEntry.findFirstOrThrow({ where: { lenderId: b.lender.id, kind: "SALE" } })).amount).toBe(800);
  });

  it("livraison chez un loueur en mode espèces : réglée au loueur, hors paiement en ligne", async () => {
    const { b, booked, reservationId } = await mixed({ delivery: true });
    // Frais locaux de 3 000 par loueur : A en ligne, B en espèces.
    expect(booked.payment.amount).toBe(68_000);
    expect(booked.reservation.cashTotal).toBe(93_000);
    expect(await settlementOf(reservationId, b.lender.id)).toMatchObject({ amountDue: 93_000, deliveryDue: 3000 });
    expect(await db.balanceEntry.count({ where: { lenderId: b.lender.id, kind: "DELIVERY_FEE" } })).toBe(0);
  });

  it("remise : bloquée sans code, code erroné compté, puis encaissement confirmé et reçu au client", async () => {
    const { a, b, client, reservationId } = await mixed();
    await lenderAdvance(a.actor, reservationId, "READY");
    await lenderAdvance(a.actor, reservationId, "IN_USE");
    await lenderAdvance(b.actor, reservationId, "READY");
    await expect(lenderAdvance(b.actor, reservationId, "IN_USE")).rejects.toMatchObject({ code: "CASH_NOT_CONFIRMED" });

    const s = await settlementOf(reservationId, b.lender.id);
    const wrong = s.code === "0000" ? "1111" : "0000";
    await expect(confirmCashPayment(b.actor, reservationId, wrong)).rejects.toMatchObject({ code: "CASH_CODE_INVALID" });
    expect((await settlementOf(reservationId, b.lender.id)).failedAttempts).toBe(1);
    await expect(confirmCashPayment(a.actor, reservationId, s.code)).rejects.toMatchObject({ code: "CONFLICT" });

    const paid = await confirmCashPayment(b.actor, reservationId, s.code);
    expect(paid.status).toBe("PAID");
    expect(await db.notification.count({ where: { userId: client.user.id, type: "cash.receipt" } })).toBe(1);
    await lenderAdvance(b.actor, reservationId, "IN_USE");
    // Le solde payé en espèces ne peut plus être annulé en ligne par le client.
    expect((await db.reservationItem.findFirstOrThrow({ where: { reservationId, lenderId: b.lender.id } })).status).toBe("IN_USE");
  });

  it("code bloqué après trop d'essais, débloqué par le support", async () => {
    const { b, reservationId } = await mixed();
    const admin = await makeAdmin();
    await updateSetting(admin.actor, "cash.max_code_attempts", 2);
    const s = await settlementOf(reservationId, b.lender.id);
    const wrong = s.code === "0000" ? "1111" : "0000";
    await expect(confirmCashPayment(b.actor, reservationId, wrong)).rejects.toMatchObject({ code: "CASH_CODE_INVALID" });
    await expect(confirmCashPayment(b.actor, reservationId, wrong)).rejects.toMatchObject({ code: "CASH_CODE_LOCKED" });
    await expect(confirmCashPayment(b.actor, reservationId, s.code)).rejects.toMatchObject({ code: "CASH_CODE_LOCKED" });
    await adminCashAction(admin.actor, s.id, { action: "UNLOCK", note: "Vérifié par téléphone avec le client" });
    expect((await confirmCashPayment(b.actor, reservationId, s.code)).status).toBe("PAID");
  });

  it("client qui ne paie pas le solde : lignes du loueur annulées, caution rendue, acompte conservé, autre loueur intact", async () => {
    const { a, b, booked, itemA, itemB, reservationId } = await mixed({ start: 0, end: 2 });
    await lenderAdvance(b.actor, reservationId, "READY");
    await reportCashUnpaid(b.actor, reservationId, "Client absent au rendez-vous de remise");

    expect((await db.reservationItem.findUniqueOrThrow({ where: { id: itemB.id } })).status).toBe("CANCELLED");
    expect((await db.reservationItem.findUniqueOrThrow({ where: { id: itemA.id } })).status).toBe("CONFIRMED");
    expect((await db.deposit.findUniqueOrThrow({ where: { itemId: itemB.id } })).status).toBe("RELEASED");
    expect((await settlementOf(reservationId, b.lender.id)).status).toBe("UNPAID");
    const refunds = await db.refund.findMany({ where: { paymentId: booked.payment.id } });
    expect(refunds.map((r) => [r.kind, r.amount])).toEqual([["DEPOSIT_RELEASE", 30_000]]);
    void a;
  });

  it("signalement d'impayé refusé avant le premier jour de location", async () => {
    const { b, reservationId } = await mixed({ start: 5 });
    await expect(reportCashUnpaid(b.actor, reservationId, "Client injoignable")).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("annulation par le client : seul l'acompte et la caution sont remboursés, le solde est annulé", async () => {
    const { a, b, client, booked, itemB, reservationId } = await mixed({ start: 10 });
    const plan = await cancelReservation(client.actor, reservationId, { itemIds: [itemB.id], reason: "Changement de programme" });
    expect(plan.rentalTotal).toBe(10_000);
    expect(plan.depositTotal).toBe(30_000);
    expect(plan.cashCancelled).toBe(90_000);
    expect((await settlementOf(reservationId, b.lender.id)).status).toBe("CANCELLED");
    // Rien n'est déduit au loueur B : il n'avait rien touché en ligne.
    expect(await db.lenderReimbursement.count({ where: { lenderId: b.lender.id } })).toBe(0);
    expect((await db.payment.findUniqueOrThrow({ where: { id: booked.payment.id } })).status).toBe("PARTIALLY_REFUNDED");
    void a;
  });

  it("annulation en ligne refusée une fois le solde payé en espèces", async () => {
    const { b, client, itemB, reservationId } = await mixed({ start: 10 });
    const s = await settlementOf(reservationId, b.lender.id);
    await confirmCashPayment(b.actor, reservationId, s.code);
    await expect(cancelReservation(client.actor, reservationId, { itemIds: [itemB.id], reason: "Je ne viens plus" })).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("le mode est figé sur la réservation et réservé aux loueurs autorisés", async () => {
    const { b, reservationId } = await mixed();
    await setPaymentMode(b.actor, { paymentMode: "ONLINE_FULL" });
    await expect(lenderAdvance(b.actor, reservationId, "READY").then(() => lenderAdvance(b.actor, reservationId, "IN_USE"))).rejects.toMatchObject({ code: "CASH_NOT_CONFIRMED" });

    const other = await makeLender(base.city.id);
    await expect(setPaymentMode(other.actor, { paymentMode: "DEPOSIT_CASH" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    const admin = await makeAdmin();
    await setLenderCashMode(admin.actor, other.lender.id, true);
    await setPaymentMode(other.actor, { paymentMode: "DEPOSIT_CASH" });
    await setLenderCashMode(admin.actor, other.lender.id, false);
    expect((await db.lender.findUniqueOrThrow({ where: { id: other.lender.id } })).paymentMode).toBe("ONLINE_FULL");
  });

  it("panier : affiche la part en ligne et la part en espèces par loueur", async () => {
    const b = await cashLender();
    const p = await makeProduct(b.lender.id, base.category.id, base.city.id, { unitPrice: 50_000, deposit: 30_000 });
    const client = await makeClient();
    await addToCart(client.user.id, { productId: p.id, quantity: 1, startDate: day(5), endDate: day(7) });
    const cart = await getCart(client.user.id);
    expect(cart.groups[0]).toMatchObject({ paymentMode: "DEPOSIT_CASH", cash: 90_000 });
    expect(cart.total).toBe(40_000);
    const admin = await makeAdmin();
    await updateSetting(admin.actor, "cash.enabled", false);
    expect((await getCart(client.user.id)).total).toBe(130_000);
  });

  it("modification : complément en ligne limité à l'acompte et à la caution, solde en espèces recalculé", async () => {
    const b = await cashLender();
    const p = await makeProduct(b.lender.id, base.category.id, base.city.id, { unitPrice: 50_000, deposit: 30_000, stock: 5 });
    const client = await makeClient();
    const { reservation } = await bookAndPay(client, [{ productId: p.id, quantity: 1, start: 10, end: 12 }]);
    const item = reservation.items[0];
    const mod = await requestModification(client.actor, reservation.id, { lines: [{ action: "UPDATE", itemId: item.id, quantity: 2 }] });
    expect(mod.differenceToPay).toBe(40_000); // acompte +10 000, caution +30 000
    expect(mod.cashAfter).toBe(180_000);
    await approveModification(b.actor, reservation.id, mod.id);
    const payment = await payModification(client.actor, reservation.id, mod.id, "WAVE", randomUUID());
    await simulatePayment(client.actor, payment.id, "success");

    expect((await db.reservationItem.findUniqueOrThrow({ where: { id: item.id } })).cashDue).toBe(180_000);
    expect((await settlementOf(reservation.id, b.lender.id)).amountDue).toBe(180_000);
    const r = await db.reservation.findUniqueOrThrow({ where: { id: reservation.id } });
    expect(r.cashTotal).toBe(180_000);
    expect(r.total).toBe(80_000);
  });
});
