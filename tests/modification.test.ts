import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { approveModification, escalateAndExpireModifications, payModification, rejectModification, relaunchModification, requestModification, cancelModification } from "@/services/modifications";
import { simulatePayment } from "@/services/payments";
import { bookAndPay } from "./flow";
import { day, makeAdmin, makeBase, makeClient, makeLender, makeProduct, resetDb } from "./helpers";

let base: Awaited<ReturnType<typeof makeBase>>;
beforeEach(async () => {
  await resetDb();
  base = await makeBase();
});

async function setup(stock = 20) {
  const lender = await makeLender(base.city.id);
  const product = await makeProduct(lender.lender.id, base.category.id, base.city.id, { unitPrice: 1000, deposit: 2000, stock });
  const client = await makeClient();
  const booked = await bookAndPay(client, [{ productId: product.id, quantity: 4, start: 10, end: 12 }]);
  return { lender, product, client, booked, item: booked.reservation.items[0], reservationId: booked.reservation.id };
}

describe("modification d'une réservation confirmée", () => {
  it("augmentation : validation du loueur, complément payé séparément, nouvelle version, stock réservé", async () => {
    const { lender, client, item, reservationId, product } = await setup();
    const before = await db.reservation.findUniqueOrThrow({ where: { id: reservationId } });
    const mod = await requestModification(client.actor, reservationId, { lines: [{ action: "UPDATE", itemId: item.id, quantity: 6 }] });
    // 6 x 1000 x 2 = 12 000 contre 8 000 ; caution 12 000 contre 8 000 : complément 8 000.
    expect(mod.status).toBe("PENDING_VALIDATION");
    expect(mod.differenceToPay).toBe(8000);
    expect(mod.refundToIssue).toBe(0);
    expect(mod.depositAfter).toBe(12_000);
    expect(mod.commissionAfter).toBe(1200);

    await expect(requestModification(client.actor, reservationId, { lines: [{ action: "UPDATE", itemId: item.id, quantity: 7 }] })).rejects.toMatchObject({ code: "CONFLICT" });
    // Rien n'est appliqué avant validation.
    expect((await db.reservationItem.findUniqueOrThrow({ where: { id: item.id } })).quantity).toBe(4);

    const accepted = await approveModification(lender.actor, reservationId, mod.id);
    expect(accepted.status).toBe("PENDING_PAYMENT");

    const payment = await payModification(client.actor, reservationId, mod.id, "WAVE", randomUUID());
    expect(payment.kind).toBe("MODIFICATION");
    expect(payment.amount).toBe(8000);
    await simulatePayment(client.actor, payment.id, "success");

    const applied = await db.modificationRequest.findUniqueOrThrow({ where: { id: mod.id } });
    expect(applied.status).toBe("APPLIED");
    const after = await db.reservation.findUniqueOrThrow({ where: { id: reservationId } });
    expect(after.currentVersion).toBe(2);
    expect(after.total).toBe(before.total + 8000);
    expect((await db.reservationItem.findUniqueOrThrow({ where: { id: item.id } })).quantity).toBe(6);
    expect((await db.deposit.findUniqueOrThrow({ where: { itemId: item.id } })).amount).toBe(12_000);
    expect(await db.reservationVersion.count({ where: { reservationId } })).toBe(2);
    const v1 = await db.reservationVersion.findUniqueOrThrow({ where: { reservationId_version: { reservationId, version: 1 } } });
    expect(v1.total).toBe(before.total);
    // Le paiement initial est resté inchangé.
    expect((await db.payment.findFirstOrThrow({ where: { reservationId, kind: "INITIAL" } })).amount).toBe(before.total);
    // Le stock supplémentaire est bien réservé.
    const items = await db.reservationItem.aggregate({ where: { productId: product.id, status: "CONFIRMED" }, _sum: { quantity: true } });
    expect(items._sum.quantity).toBe(6);
  });

  it("diminution : remboursement intégral de la différence, appliqué après validation", async () => {
    const { lender, client, item, reservationId } = await setup();
    const mod = await requestModification(client.actor, reservationId, { lines: [{ action: "UPDATE", itemId: item.id, quantity: 1 }] });
    // 1 x 1000 x 2 = 2 000 contre 8 000 : -6 000 de location et -6 000 de caution.
    expect(mod.refundToIssue).toBe(12_000);
    expect(mod.differenceToPay).toBe(0);
    const applied = await approveModification(lender.actor, reservationId, mod.id);
    expect(applied.status).toBe("APPLIED");
    const refunds = await db.refund.findMany({ where: { reservationId } });
    expect(refunds.reduce((s, r) => s + r.amount, 0)).toBe(12_000);
    expect((await db.reservation.findUniqueOrThrow({ where: { id: reservationId } })).currentVersion).toBe(2);
    expect((await db.reservationItem.findUniqueOrThrow({ where: { id: item.id } })).quantity).toBe(1);
  });

  it("refuse une modification trop proche du début de la location", async () => {
    const lender = await makeLender(base.city.id);
    const product = await makeProduct(lender.lender.id, base.category.id, base.city.id, { stock: 10 });
    const client = await makeClient();
    const booked = await bookAndPay(client, [{ productId: product.id, quantity: 1, start: 1, end: 3 }]);
    await expect(requestModification(client.actor, booked.reservation.id, { lines: [{ action: "UPDATE", itemId: booked.reservation.items[0].id, quantity: 2 }] })).rejects.toMatchObject({ code: "MODIFICATION_DEADLINE_EXCEEDED" });
  });

  it("refuse une augmentation au-delà du stock disponible", async () => {
    const { client, item, reservationId } = await setup(5);
    await expect(requestModification(client.actor, reservationId, { lines: [{ action: "UPDATE", itemId: item.id, quantity: 9 }] })).rejects.toMatchObject({ code: "STOCK_INSUFFICIENT" });
  });

  it("ajoute un article du même loueur", async () => {
    const { lender, client, reservationId, product } = await setup();
    const other = await makeProduct(lender.lender.id, base.category.id, base.city.id, { name: "Table ronde", unitPrice: 5000, deposit: 10_000, stock: 5 });
    const mod = await requestModification(client.actor, reservationId, { lines: [{ action: "ADD", productId: other.id, quantity: 2, startDate: day(10), endDate: day(11) }] });
    expect(mod.differenceToPay).toBe(10_000 + 20_000);
    await approveModification(lender.actor, reservationId, mod.id);
    const payment = await payModification(client.actor, reservationId, mod.id, "CARD", randomUUID());
    await simulatePayment(client.actor, payment.id, "success");
    const items = await db.reservationItem.findMany({ where: { reservationId }, orderBy: { createdAt: "asc" } });
    expect(items).toHaveLength(2);
    expect(items[1].status).toBe("CONFIRMED");
    expect(await db.deposit.count({ where: { item: { reservationId }, status: "HELD" } })).toBe(2);
    void product;
  });

  it("refuse la modification d'un loueur par un autre loueur", async () => {
    const { client, item, reservationId } = await setup();
    const stranger = await makeLender(base.city.id);
    const mod = await requestModification(client.actor, reservationId, { lines: [{ action: "UPDATE", itemId: item.id, quantity: 5 }] });
    await expect(approveModification(stranger.actor, reservationId, mod.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("escalade à l'administration sans réponse du loueur sous 2 h, puis relance ou arbitrage", async () => {
    const { client, item, reservationId } = await setup();
    const mod = await requestModification(client.actor, reservationId, { lines: [{ action: "UPDATE", itemId: item.id, quantity: 5 }] });
    await db.modificationRequest.update({ where: { id: mod.id }, data: { respondBy: new Date(Date.now() - 60_000) } });
    const result = await escalateAndExpireModifications();
    expect(result.escalated).toBe(1);
    const escalated = await db.modificationRequest.findUniqueOrThrow({ where: { id: mod.id } });
    expect(escalated.escalatedAt).toBeTruthy();
    expect(escalated.status).toBe("PENDING_VALIDATION"); // ni acceptée ni refusée automatiquement

    const admin = await makeAdmin("ADMIN_SUPPORT");
    const relaunched = await relaunchModification(admin.actor, reservationId, mod.id, 3);
    expect(relaunched.escalatedAt).toBeNull();
    expect(relaunched.respondBy.getTime()).toBeGreaterThan(Date.now() + 2 * 3_600_000);

    const rejected = await rejectModification(admin.actor, reservationId, mod.id, "Stock réservé pour un autre client");
    expect(rejected.status).toBe("REJECTED");
    expect((await db.reservationItem.findUniqueOrThrow({ where: { id: item.id } })).quantity).toBe(4);
  });

  it("annule une demande, et expire les demandes périmées", async () => {
    const { client, item, reservationId } = await setup();
    const mod = await requestModification(client.actor, reservationId, { lines: [{ action: "UPDATE", itemId: item.id, quantity: 5 }] });
    expect((await cancelModification(client.actor, reservationId, mod.id)).status).toBe("CANCELLED");
    const again = await requestModification(client.actor, reservationId, { lines: [{ action: "UPDATE", itemId: item.id, quantity: 5 }] });
    await db.modificationRequest.update({ where: { id: again.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await escalateAndExpireModifications()).expired).toBe(1);
    expect((await db.modificationRequest.findUniqueOrThrow({ where: { id: again.id } })).status).toBe("EXPIRED");
  });
});
