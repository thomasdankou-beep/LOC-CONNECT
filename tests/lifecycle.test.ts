import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { lenderAdvance } from "@/services/reservations";
import { acknowledgeReport, contestReport, createReturnReport, releaseDeposit, settleExpiredReports } from "@/services/returns";
import { cancelReservation, adminRefund } from "@/services/refunds";
import { lenderBalance, listRecoveries, markRecovered, runPayout } from "@/services/payouts";
import { decideDispute, openDispute } from "@/services/disputes";
import { initiatePayment, simulatePayment } from "@/services/payments";
import { createReview } from "@/services/reviews";
import { runMaintenance } from "@/services/maintenance";
import { bookAndPay } from "./flow";
import { makeAdmin, makeBase, makeClient, makeLender, makeProduct, resetDb, date, day } from "./helpers";

let base: Awaited<ReturnType<typeof makeBase>>;
beforeEach(async () => {
  await resetDb();
  base = await makeBase();
});

async function rentedAndInUse(opts: { deposit?: number; refundPrice?: number; qty?: number; unitPrice?: number; extra?: boolean } = {}) {
  const lender = await makeLender(base.city.id);
  const product = await makeProduct(lender.lender.id, base.category.id, base.city.id, { unitPrice: opts.unitPrice ?? 10_000, deposit: opts.deposit ?? 20_000, refundPrice: opts.refundPrice ?? 15_000, stock: 20, extra: opts.extra });
  const client = await makeClient();
  const booked = await bookAndPay(client, [{ productId: product.id, quantity: opts.qty ?? 2, start: 5, end: 7 }]);
  const item = booked.reservation.items[0];
  await lenderAdvance(lender.actor, booked.reservation.id, "READY");
  await lenderAdvance(lender.actor, booked.reservation.id, "IN_USE");
  return { lender, product, client, booked, item, reservationId: booked.reservation.id };
}

describe("cycle de location complet", () => {
  it("retour conforme : caution libérée, ligne terminée, avis possible", async () => {
    const { lender, client, item, reservationId } = await rentedAndInUse();
    const report = await createReturnReport(lender.actor, item.id, { returnedQuantity: 2, lostQuantity: 0, damagedQuantity: 0, condition: "GOOD", damageAmount: 0 }, []);
    expect(report.status).toBe("VALIDATED");
    const deposit = await db.deposit.findUniqueOrThrow({ where: { itemId: item.id } });
    expect(deposit.status).toBe("RELEASED");
    expect(deposit.releasedAmount).toBe(40_000);
    expect((await db.reservationItem.findUniqueOrThrow({ where: { id: item.id } })).status).toBe("COMPLETED");
    expect((await db.reservation.findUniqueOrThrow({ where: { id: reservationId } })).status).toBe("COMPLETED");
    const released = await db.financialTransaction.findFirst({ where: { itemId: undefined, reservationId, type: "DEPOSIT_RELEASED" } });
    expect(released?.amount).toBe(40_000);

    const review = await createReview(client.actor, item.id, { productRating: 5, lenderRating: 4, experienceRating: 5, comment: "Très bien" });
    expect(review.status).toBe("PUBLISHED");
    expect((await db.lender.findUniqueOrThrow({ where: { id: lender.lender.id } })).ratingAvg).toBe(4);
    await expect(createReview(client.actor, item.id, { productRating: 5, lenderRating: 4, experienceRating: 5 })).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("retour avec dommages : retenue plafonnée, complément facturé, fenêtre de contestation", async () => {
    const { lender, client, item } = await rentedAndInUse({ deposit: 10_000, refundPrice: 15_000, qty: 2 });
    // 1 unité perdue (15 000) + dommages 3 000 sur 1 unité endommagée = 18 000 ; caution totale 20 000.
    await expect(createReturnReport(lender.actor, item.id, { returnedQuantity: 1, lostQuantity: 1, damagedQuantity: 1, condition: "DAMAGED", damageAmount: 3000 }, [])).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    const report = await createReturnReport(lender.actor, item.id, { returnedQuantity: 1, lostQuantity: 1, damagedQuantity: 1, condition: "DAMAGED", damageAmount: 3000, comment: "Pied cassé" }, [{ key: "private/returns/x.jpg", mimeType: "image/jpeg" }]);
    expect(report.status).toBe("SUBMITTED");
    expect(report.withheldAmount).toBe(18_000);
    expect(report.extraChargeAmount).toBe(0);
    expect(report.contestDeadline).toBeTruthy();
    expect((await db.deposit.findUniqueOrThrow({ where: { itemId: item.id } })).status).toBe("HELD");

    await acknowledgeReport(client.actor, item.id);
    const deposit = await db.deposit.findUniqueOrThrow({ where: { itemId: item.id } });
    expect(deposit.status).toBe("PARTIALLY_WITHHELD");
    expect(deposit.withheldAmount).toBe(18_000);
    expect(deposit.releasedAmount).toBe(2000);
    expect((await db.product.findFirstOrThrow({ where: { lenderId: lender.lender.id } })).stockQuantity).toBe(19);
    expect(await db.balanceEntry.count({ where: { itemId: item.id, kind: "DEPOSIT_CAPTURE", amount: 18_000 } })).toBe(1);
  });

  it("facture le complément seulement si le produit l'autorise", async () => {
    const withExtra = await rentedAndInUse({ deposit: 5000, refundPrice: 20_000, qty: 1, extra: true });
    await createReturnReport(withExtra.lender.actor, withExtra.item.id, { returnedQuantity: 0, lostQuantity: 1, damagedQuantity: 0, condition: "LOST" }, [{ key: "private/returns/y.jpg", mimeType: "image/jpeg" }]);
    await acknowledgeReport(withExtra.client.actor, withExtra.item.id);
    const charge = await db.extraCharge.findFirstOrThrow({ where: { itemId: withExtra.item.id } });
    expect(charge.amount).toBe(15_000);

    // Paiement du complément via le même circuit webhook.
    const paid = await initiatePayment(withExtra.client.actor, { extraChargeId: charge.id, method: "WAVE", idempotencyKey: randomUUID() });
    await simulatePayment(withExtra.client.actor, paid.payment.id, "success");
    expect((await db.extraCharge.findUniqueOrThrow({ where: { id: charge.id } })).status).toBe("PAID");

    const noExtra = await rentedAndInUse({ deposit: 5000, refundPrice: 20_000, qty: 1, extra: false });
    await createReturnReport(noExtra.lender.actor, noExtra.item.id, { returnedQuantity: 0, lostQuantity: 1, damagedQuantity: 0, condition: "LOST" }, [{ key: "private/returns/z.jpg", mimeType: "image/jpeg" }]);
    await acknowledgeReport(noExtra.client.actor, noExtra.item.id);
    expect(await db.extraCharge.count({ where: { itemId: noExtra.item.id } })).toBe(0);
  });

  it("règle automatiquement un constat non contesté après la fenêtre", async () => {
    const { lender, item } = await rentedAndInUse({ deposit: 10_000, refundPrice: 4000, qty: 1 });
    await createReturnReport(lender.actor, item.id, { returnedQuantity: 0, lostQuantity: 1, damagedQuantity: 0, condition: "LOST" }, [{ key: "private/returns/a.jpg", mimeType: "image/jpeg" }]);
    expect(await settleExpiredReports(new Date())).toBe(0);
    expect(await settleExpiredReports(new Date(Date.now() + 49 * 3_600_000))).toBe(1);
    expect((await db.deposit.findUniqueOrThrow({ where: { itemId: item.id } })).status).toBe("PARTIALLY_WITHHELD");
  });

  it("gèle la caution et bloque le versement en cas de contestation, puis arbitrage", async () => {
    const { lender, client, item, reservationId } = await rentedAndInUse({ deposit: 20_000, refundPrice: 20_000, qty: 1 });
    await createReturnReport(lender.actor, item.id, { returnedQuantity: 1, lostQuantity: 0, damagedQuantity: 1, condition: "DAMAGED", damageAmount: 20_000 }, [{ key: "private/returns/b.jpg", mimeType: "image/jpeg" }]);
    const dispute = await contestReport(client.actor, item.id, "Le dommage existait déjà à la livraison");
    expect((await db.deposit.findUniqueOrThrow({ where: { itemId: item.id } })).frozen).toBe(true);
    expect((await db.reservationItem.findUniqueOrThrow({ where: { id: item.id } })).status).toBe("DISPUTED");
    expect(await db.balanceEntry.count({ where: { itemId: item.id, blocked: true } })).toBeGreaterThan(0);
    expect((await lenderBalance(lender.lender.id)).blocked).toBeGreaterThan(0);

    const admin = await makeAdmin();
    await decideDispute(admin.actor, dispute.id, { outcome: "PARTIAL", amount: 5000, decision: "Dommage préexistant en partie : 5 000 FCFA retenus." });
    const deposit = await db.deposit.findUniqueOrThrow({ where: { itemId: item.id } });
    expect(deposit.withheldAmount).toBe(5000);
    expect(deposit.releasedAmount).toBe(15_000);
    expect((await db.reservationItem.findUniqueOrThrow({ where: { id: item.id } })).status).toBe("COMPLETED");
    expect(await db.balanceEntry.count({ where: { itemId: item.id, blocked: true } })).toBe(0);
    expect((await db.reservation.findUniqueOrThrow({ where: { id: reservationId } })).status).toBe("COMPLETED");
  });

  it("un litige ciblé ne touche que le loueur concerné", async () => {
    const a = await makeLender(base.city.id, { name: "A" });
    const b = await makeLender(base.city.id, { name: "B" });
    const pa = await makeProduct(a.lender.id, base.category.id, base.city.id, { name: "Tente A" });
    const pb = await makeProduct(b.lender.id, base.category.id, base.city.id, { name: "Tente B" });
    const client = await makeClient();
    const { reservation } = await bookAndPay(client, [{ productId: pa.id, quantity: 1, start: 5, end: 7 }, { productId: pb.id, quantity: 1, start: 5, end: 7 }]);
    for (const l of [a, b]) {
      await lenderAdvance(l.actor, reservation.id, "READY");
      await lenderAdvance(l.actor, reservation.id, "IN_USE");
    }
    const itemA = reservation.items.find((i) => i.lenderId === a.lender.id)!;
    const itemB = reservation.items.find((i) => i.lenderId === b.lender.id)!;
    await openDispute(client.actor, { reservationId: reservation.id, lenderId: a.lender.id, reason: "Matériel non conforme", description: "La tente est arrivée déchirée et sale.", disputedAmount: 3000 });
    expect((await db.reservationItem.findUniqueOrThrow({ where: { id: itemA.id } })).status).toBe("DISPUTED");
    expect((await db.reservationItem.findUniqueOrThrow({ where: { id: itemB.id } })).status).toBe("IN_USE");
    expect((await db.reservation.findUniqueOrThrow({ where: { id: reservation.id } })).status).toBe("IN_USE");
    expect(await db.balanceEntry.count({ where: { lenderId: b.lender.id, blocked: true } })).toBe(0);
  });
});

describe("annulation, remboursement et recouvrement", () => {
  async function paidConfirmed(startOffset: number) {
    const lender = await makeLender(base.city.id);
    const product = await makeProduct(lender.lender.id, base.category.id, base.city.id, { unitPrice: 10_000, deposit: 20_000 });
    const client = await makeClient();
    const booked = await bookAndPay(client, [{ productId: product.id, quantity: 1, start: startOffset, end: startOffset + 2 }]);
    return { lender, client, booked, item: booked.reservation.items[0], reservationId: booked.reservation.id, payment: booked.payment };
  }

  it("rembourse 100 % + caution si annulé tôt, et déduit la part du loueur non encore versé", async () => {
    const { lender, client, item, reservationId, payment } = await paidConfirmed(10);
    const plan = await cancelReservation(client.actor, reservationId, { reason: "Changement de programme" });
    expect(plan.lines[0].percent).toBe(100);
    expect(plan.clientTotal).toBe(20_000 + 20_000);
    expect((await db.reservationItem.findUniqueOrThrow({ where: { id: item.id } })).status).toBe("REFUNDED");
    expect((await db.reservation.findUniqueOrThrow({ where: { id: reservationId } })).status).toBe("REFUNDED");
    expect((await db.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe("PARTIALLY_REFUNDED");
    const rec = await db.lenderReimbursement.findFirstOrThrow({ where: { lenderId: lender.lender.id } });
    expect(rec.status).toBe("NOT_NEEDED");
    expect(rec.impactedAmount).toBe(18_000);
    const balance = await lenderBalance(lender.lender.id);
    expect(balance.frozen + balance.available + balance.blocked - balance.owed).toBe(0);
    const out = await db.financialTransaction.aggregate({ where: { reservationId, direction: "OUT" }, _sum: { amount: true } });
    expect(out._sum.amount).toBe(40_000);
  });

  it("applique 50 % dans la fenêtre intermédiaire (politique par défaut)", async () => {
    const { client, reservationId } = await paidConfirmed(2);
    const plan = await cancelReservation(client.actor, reservationId, { reason: "Imprévu" });
    expect(plan.lines[0].percent).toBe(50);
    expect(plan.lines[0].rentalRefund).toBe(10_000);
  });

  it("refuse l'annulation d'une location en cours", async () => {
    const { client, reservationId } = await rentedAndInUse().then((r) => ({ client: r.client, reservationId: r.reservationId }));
    await expect(cancelReservation(client.actor, reservationId, { reason: "Trop tard" })).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
  });

  it("crée un recouvrement si le loueur a déjà été versé, puis le compense sur le versement suivant", async () => {
    const lender = await makeLender(base.city.id);
    const admin = await makeAdmin();
    const product = await makeProduct(lender.lender.id, base.category.id, base.city.id, { unitPrice: 10_000, deposit: 0 });
    const client = await makeClient();
    const first = await bookAndPay(client, [{ productId: product.id, quantity: 1, start: 10, end: 12 }]);
    const second = await bookAndPay(client, [{ productId: product.id, quantity: 1, start: 20, end: 22 }]);

    // Première vente : versée (gel levé artificiellement).
    await db.balanceEntry.updateMany({ where: { itemId: first.reservation.items[0].id }, data: { availableAt: new Date(Date.now() - 1000) } });
    const p1 = await runPayout(admin.actor, lender.lender.id);
    expect(p1?.amount).toBe(18_000);

    // Remboursement exceptionnel après versement : la part du loueur est à recouvrer.
    await adminRefund(admin.actor, first.payment.id, { amount: 6000, reason: "Geste commercial", lenderId: lender.lender.id, lenderShare: 6000 });
    const rec = await db.lenderReimbursement.findFirstOrThrow({ where: { lenderId: lender.lender.id } });
    expect(rec.status).toBe("TO_RECOVER");
    expect((await lenderBalance(lender.lender.id)).owed).toBe(6000);
    expect((await listRecoveries({ status: "TO_RECOVER" })).total).toBe(1);

    // Sans solde disponible, aucun versement n'est émis.
    expect(await runPayout(admin.actor, lender.lender.id)).toBeNull();

    // Une nouvelle vente disponible compense la déduction en attente.
    await db.balanceEntry.updateMany({ where: { itemId: second.reservation.items[0].id }, data: { availableAt: new Date(Date.now() - 1000) } });
    const p2 = await runPayout(admin.actor, lender.lender.id);
    expect(p2!.amount).toBe(18_000 - 6000);
    expect((await db.lenderReimbursement.findUniqueOrThrow({ where: { id: rec.id } })).status).toBe("OFFSET");
    expect((await lenderBalance(lender.lender.id)).owed).toBe(0);
  });

  it("clôture manuellement un recouvrement", async () => {
    const lender = await makeLender(base.city.id);
    const admin = await makeAdmin();
    const product = await makeProduct(lender.lender.id, base.category.id, base.city.id, { unitPrice: 10_000, deposit: 0 });
    const client = await makeClient();
    const booked = await bookAndPay(client, [{ productId: product.id, quantity: 1, start: 10, end: 12 }]);
    await db.balanceEntry.updateMany({ where: { itemId: booked.reservation.items[0].id }, data: { availableAt: new Date(Date.now() - 1000) } });
    await runPayout(admin.actor, lender.lender.id);
    await cancelReservation(client.actor, booked.reservation.id, { reason: "Annulation" });
    const rec = await db.lenderReimbursement.findFirstOrThrow({ where: { lenderId: lender.lender.id, status: "TO_RECOVER" } });
    expect(rec.impactedAmount).toBe(18_000);
    expect((await lenderBalance(lender.lender.id)).owed).toBe(18_000);
    await markRecovered(admin.actor, rec.id, "Virement reçu");
    expect((await lenderBalance(lender.lender.id)).owed).toBe(0);
    expect((await db.lenderReimbursement.findUniqueOrThrow({ where: { id: rec.id } })).status).toBe("RECOVERED");
  });

  it("empêche la libération de caution sans constat de retour", async () => {
    const { client, item } = await rentedAndInUse();
    void client;
    const deposit = await db.deposit.findUniqueOrThrow({ where: { itemId: item.id } });
    const admin = await makeAdmin();
    await expect(releaseDeposit(admin.actor, deposit.id)).rejects.toMatchObject({ code: "CONFLICT" });
  });
});

describe("maintenance", () => {
  it("fait passer une location livrée en cours puis en attente de retour", async () => {
    const lender = await makeLender(base.city.id);
    const product = await makeProduct(lender.lender.id, base.category.id, base.city.id);
    const client = await makeClient();
    const booked = await bookAndPay(client, [{ productId: product.id, quantity: 1, start: 5, end: 7 }]);
    const item = booked.reservation.items[0];
    await db.reservationItem.update({ where: { id: item.id }, data: { status: "DELIVERED", startDate: date(0), endDate: date(2) } });
    await runMaintenance();
    expect((await db.reservationItem.findUniqueOrThrow({ where: { id: item.id } })).status).toBe("IN_USE");
    await db.reservationItem.update({ where: { id: item.id }, data: { startDate: date(-5), endDate: date(-2) } });
    await runMaintenance();
    expect((await db.reservationItem.findUniqueOrThrow({ where: { id: item.id } })).status).toBe("RETURN_PENDING");
    void day;
  });
});
