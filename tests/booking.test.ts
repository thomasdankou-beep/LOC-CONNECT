import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { addToCart } from "@/services/cart";
import { createHold, expireHolds, releaseHold } from "@/services/holds";
import { createReservationFromHold } from "@/services/reservations";
import { handleWebhook, initiatePayment, simulatePayment } from "@/services/payments";
import { signPayload } from "@/services/payments/providers";
import { availabilityForProduct, minAvailable } from "@/services/availability";
import { bookAndPay } from "./flow";
import { date, day, makeBase, makeClient, makeLender, makeProduct, resetDb } from "./helpers";

let base: Awaited<ReturnType<typeof makeBase>>;

beforeEach(async () => {
  await resetDb();
  base = await makeBase();
});

describe("disponibilité", () => {
  it("déduit le stock réservé, les HOLD actifs et ignore les HOLD expirés", async () => {
    const lender = await makeLender(base.city.id);
    const product = await makeProduct(lender.lender.id, base.category.id, base.city.id, { stock: 10 });
    const c1 = await makeClient("Awa");
    await addToCart(c1.user.id, { productId: product.id, quantity: 4, startDate: day(10), endDate: day(12) });
    const hold = await createHold(c1.user.id, { fulfillmentType: "PICKUP", replaceExisting: false });

    let days = await availabilityForProduct(db, product.id, date(10), date(12));
    expect(minAvailable(days)).toBe(6);
    expect(days[0].held).toBe(4);

    await db.hold.update({ where: { id: hold.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    days = await availabilityForProduct(db, product.id, date(10), date(12));
    expect(minAvailable(days)).toBe(10);

    await expireHolds();
    expect((await db.hold.findUniqueOrThrow({ where: { id: hold.id } })).status).toBe("EXPIRED");
  });

  it("bloque un loueur indisponible", async () => {
    const lender = await makeLender(base.city.id);
    const product = await makeProduct(lender.lender.id, base.category.id, base.city.id);
    await db.lenderUnavailability.create({ data: { lenderId: lender.lender.id, startDate: date(5), endDate: date(8) } });
    const c = await makeClient();
    await expect(addToCart(c.user.id, { productId: product.id, quantity: 1, startDate: day(6), endDate: day(7) })).rejects.toMatchObject({ code: "STOCK_INSUFFICIENT" });
    await expect(addToCart(c.user.id, { productId: product.id, quantity: 1, startDate: day(8), endDate: day(9) })).resolves.toBeTruthy();
  });

  it("refuse dates incohérentes, quantités nulles et dates passées", async () => {
    const lender = await makeLender(base.city.id);
    const product = await makeProduct(lender.lender.id, base.category.id, base.city.id);
    const c = await makeClient();
    await expect(addToCart(c.user.id, { productId: product.id, quantity: 1, startDate: day(5), endDate: day(5) })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(addToCart(c.user.id, { productId: product.id, quantity: 1, startDate: day(6), endDate: day(5) })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(addToCart(c.user.id, { productId: product.id, quantity: 1, startDate: day(-3), endDate: day(2) })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(addToCart(c.user.id, { productId: product.id, quantity: 0, startDate: day(5), endDate: day(6) } as never)).rejects.toBeTruthy();
  });
});

describe("HOLD", () => {
  it("applique les limites anti-abus (1 par produit, 3 au total) et la libération", async () => {
    const lender = await makeLender(base.city.id);
    const products = await Promise.all([1, 2, 3, 4].map((i) => makeProduct(lender.lender.id, base.category.id, base.city.id, { name: `Produit ${i}` })));
    const c = await makeClient();

    const holdFor = async (productId: string, replace = false, quantity = 1) => {
      await db.cartItem.deleteMany({ where: { cart: { userId: c.user.id } } });
      await addToCart(c.user.id, { productId, quantity, startDate: day(10), endDate: day(11) });
      return createHold(c.user.id, { fulfillmentType: "PICKUP", replaceExisting: replace });
    };

    const h1 = await holdFor(products[0].id);
    await expect(holdFor(products[0].id, false, 2)).rejects.toMatchObject({ code: "HOLD_LIMIT_REACHED" });
    await holdFor(products[1].id);
    await holdFor(products[2].id);
    await expect(holdFor(products[3].id)).rejects.toMatchObject({ code: "HOLD_LIMIT_REACHED" });

    await releaseHold(c.user.id, h1.id);
    await expect(holdFor(products[3].id)).resolves.toBeTruthy();
  });

  it("renvoie le HOLD existant pour un panier identique (idempotence)", async () => {
    const lender = await makeLender(base.city.id);
    const product = await makeProduct(lender.lender.id, base.category.id, base.city.id);
    const c = await makeClient();
    await addToCart(c.user.id, { productId: product.id, quantity: 2, startDate: day(10), endDate: day(11) });
    const a = await createHold(c.user.id, { fulfillmentType: "PICKUP", replaceExisting: false });
    const b = await createHold(c.user.id, { fulfillmentType: "PICKUP", replaceExisting: false });
    expect(b.id).toBe(a.id);
    expect(await db.hold.count({ where: { userId: c.user.id } })).toBe(1);
  });

  it("réduit la durée pour un client à fort taux de HOLD non convertis", async () => {
    const lender = await makeLender(base.city.id);
    const product = await makeProduct(lender.lender.id, base.category.id, base.city.id);
    const c = await makeClient();
    for (let i = 0; i < 6; i++) await db.hold.create({ data: { userId: c.user.id, status: "EXPIRED", expiresAt: new Date(), durationMinutes: 15 } });
    await addToCart(c.user.id, { productId: product.id, quantity: 1, startDate: day(10), endDate: day(11) });
    const hold = await createHold(c.user.id, { fulfillmentType: "PICKUP", replaceExisting: false });
    expect(hold.durationMinutes).toBe(5);
  });
});

describe("réservation multi-loueurs et paiement unique", () => {
  it("répartit un paiement unique entre loueurs, fige les montants et bloque les cautions", async () => {
    const a = await makeLender(base.city.id, { name: "Loueur A" });
    const b = await makeLender(base.city2.id, { name: "Loueur B" });
    const chairs = await makeProduct(a.lender.id, base.category.id, base.city.id, { name: "Chaises", unitPrice: 1000, stock: 100, deposit: 500 });
    const tent = await makeProduct(b.lender.id, base.category.id, base.city2.id, { name: "Chapiteau", unitPrice: 80_000, stock: 2, deposit: 300_000 });
    const client = await makeClient();

    const { reservation, payment } = await bookAndPay(client, [
      { productId: chairs.id, quantity: 50, start: 10, end: 12 },
      { productId: tent.id, quantity: 1, start: 10, end: 11 },
    ], { delivery: true, cityId: base.city.id });

    expect(payment.status).toBe("PAID");
    expect(reservation.status).toBe("CONFIRMED");
    expect(reservation.items.every((i) => i.status === "CONFIRMED")).toBe(true);
    // chaises : 50 x 1000 x 2 = 100 000 ; chapiteau : 80 000 ; livraison A local 3 000, B distant 8 000.
    expect(reservation.subtotal).toBe(180_000);
    expect(reservation.deliveryFee).toBe(11_000);
    expect(reservation.depositTotal).toBe(25_000 + 300_000);
    expect(reservation.commissionTotal).toBe(18_000);
    expect(reservation.total).toBe(180_000 + 11_000 + 325_000);
    expect(payment.amount).toBe(reservation.total);

    const allocations = await db.paymentAllocation.findMany({ where: { paymentId: payment.id } });
    expect(allocations).toHaveLength(2);
    const allocA = allocations.find((x) => x.lenderId === a.lender.id)!;
    expect(allocA.rentalAmount).toBe(100_000);
    expect(allocA.deliveryAmount).toBe(3000);
    expect(allocA.commissionAmount).toBe(10_000);
    expect(allocA.netAmount).toBe(93_000);

    const deposits = await db.deposit.findMany({ where: { item: { reservationId: reservation.id } } });
    expect(deposits.every((d) => d.status === "HELD")).toBe(true);

    expect(await db.delivery.count({ where: { reservationId: reservation.id } })).toBe(2);
    expect((await db.hold.findUniqueOrThrow({ where: { id: reservation.holdId! } })).status).toBe("CONVERTED");
    expect(await db.cartItem.count({ where: { cart: { userId: client.user.id } } })).toBe(0);

    const journal = await db.financialTransaction.findMany({ where: { reservationId: reservation.id } });
    expect(journal.filter((t) => t.type === "PAYMENT_RECEIVED").reduce((s, t) => s + t.amount, 0)).toBe(reservation.total);
    expect(journal.some((t) => t.type === "COMMISSION")).toBe(true);
  });

  it("gèle le versement du loueur jusqu'à la fin de location + délai de gel", async () => {
    const a = await makeLender(base.city.id);
    const product = await makeProduct(a.lender.id, base.category.id, base.city.id, { unitPrice: 10_000 });
    const client = await makeClient();
    const { reservation } = await bookAndPay(client, [{ productId: product.id, quantity: 1, start: 10, end: 12 }]);
    const entry = await db.balanceEntry.findFirstOrThrow({ where: { itemId: reservation.items[0].id, kind: "SALE" } });
    expect(entry.amount).toBe(20_000 - 2000);
    expect(entry.availableAt.getTime()).toBe(date(12).getTime() + 72 * 3_600_000);
  });

  it("recalcule les montants côté serveur : le client ne peut rien imposer", async () => {
    const a = await makeLender(base.city.id);
    const product = await makeProduct(a.lender.id, base.category.id, base.city.id, { unitPrice: 1000 });
    const client = await makeClient();
    const { reservation } = await bookAndPay(client, [{ productId: product.id, quantity: 2, start: 10, end: 11 }], { pay: false });
    await db.product.update({ where: { id: product.id }, data: { unitPrice: 999_999 } });
    const fresh = await db.reservation.findUniqueOrThrow({ where: { id: reservation.id } });
    expect(fresh.subtotal).toBe(2000);
  });
});

describe("paiement : webhook signé et idempotent", () => {
  it("ne traite jamais deux fois le même événement", async () => {
    const a = await makeLender(base.city.id);
    const product = await makeProduct(a.lender.id, base.category.id, base.city.id);
    const client = await makeClient();
    const { payment } = await bookAndPay(client, [{ productId: product.id, quantity: 1, start: 10, end: 11 }], { pay: false });
    const event = { id: "evt_fixed_1", type: "payment.succeeded", data: { reference: payment.reference, amount: payment.amount } };
    const raw = JSON.stringify(event);
    const first = await handleWebhook("simulated", raw, signPayload(raw));
    const second = await handleWebhook("simulated", raw, signPayload(raw));
    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);
    expect(await db.paymentAllocation.count({ where: { paymentId: payment.id } })).toBe(1);
    expect(await db.financialTransaction.count({ where: { paymentId: payment.id, type: "PAYMENT_RECEIVED" } })).toBe(1);
  });

  it("traite une livraison simultanée du même paiement sous deux événements différents sans doublon", async () => {
    const a = await makeLender(base.city.id);
    const product = await makeProduct(a.lender.id, base.category.id, base.city.id);
    const client = await makeClient();
    const { payment } = await bookAndPay(client, [{ productId: product.id, quantity: 1, start: 10, end: 11 }], { pay: false });
    const send = (id: string) => {
      const raw = JSON.stringify({ id, type: "payment.succeeded", data: { reference: payment.reference, amount: payment.amount } });
      return handleWebhook("simulated", raw, signPayload(raw));
    };
    await Promise.all([send("evt_a"), send("evt_b")]);
    expect(await db.paymentAllocation.count({ where: { paymentId: payment.id } })).toBe(1);
    expect(await db.deposit.count({ where: { status: "HELD" } })).toBe(1);
  });

  it("refuse une signature invalide et un montant incohérent", async () => {
    const a = await makeLender(base.city.id);
    const product = await makeProduct(a.lender.id, base.category.id, base.city.id);
    const client = await makeClient();
    const { payment } = await bookAndPay(client, [{ productId: product.id, quantity: 1, start: 10, end: 11 }], { pay: false });
    const raw = JSON.stringify({ id: "evt_x", type: "payment.succeeded", data: { reference: payment.reference, amount: payment.amount } });
    await expect(handleWebhook("simulated", raw, "deadbeef")).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    const bad = JSON.stringify({ id: "evt_y", type: "payment.succeeded", data: { reference: payment.reference, amount: 1 } });
    await expect(handleWebhook("simulated", bad, signPayload(bad))).rejects.toMatchObject({ code: "PAYMENT_AMOUNT_MISMATCH" });
    expect((await db.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe("PENDING");
  });

  it("rend le stock après un paiement échoué et permet de réessayer", async () => {
    const a = await makeLender(base.city.id);
    const product = await makeProduct(a.lender.id, base.category.id, base.city.id);
    const client = await makeClient();
    const { reservation, payment } = await bookAndPay(client, [{ productId: product.id, quantity: 1, start: 10, end: 11 }], { pay: false });
    await simulatePayment(client.actor, payment.id, "failure");
    expect((await db.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe("FAILED");
    expect((await db.reservation.findUniqueOrThrow({ where: { id: reservation.id } })).status).toBe("HOLD");
    const retry = await initiatePayment(client.actor, { reservationId: reservation.id, method: "ORANGE_MONEY", idempotencyKey: randomUUID() });
    await simulatePayment(client.actor, retry.payment.id, "success");
    expect((await db.reservation.findUniqueOrThrow({ where: { id: reservation.id } })).status).toBe("CONFIRMED");
  });

  it("rejoue la même clé d'idempotence sans créer de second paiement", async () => {
    const a = await makeLender(base.city.id);
    const product = await makeProduct(a.lender.id, base.category.id, base.city.id);
    const client = await makeClient();
    await addToCart(client.user.id, { productId: product.id, quantity: 1, startDate: day(10), endDate: day(11) });
    const hold = await createHold(client.user.id, { fulfillmentType: "PICKUP", replaceExisting: true });
    const reservation = await createReservationFromHold(client.user.id, hold.id);
    const key = randomUUID();
    const p1 = await initiatePayment(client.actor, { reservationId: reservation.id, method: "WAVE", idempotencyKey: key });
    const p2 = await initiatePayment(client.actor, { reservationId: reservation.id, method: "WAVE", idempotencyKey: key });
    expect(p2.payment.id).toBe(p1.payment.id);
    expect(await db.payment.count()).toBe(1);
  });

  it("annule la réservation quand le HOLD expire sans paiement", async () => {
    const a = await makeLender(base.city.id);
    const product = await makeProduct(a.lender.id, base.category.id, base.city.id);
    const client = await makeClient();
    const { reservation, hold } = await bookAndPay(client, [{ productId: product.id, quantity: 1, start: 10, end: 11 }], { pay: false });
    await db.hold.update({ where: { id: hold.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await expireHolds();
    const r = await db.reservation.findUniqueOrThrow({ where: { id: reservation.id } });
    expect(r.status).toBe("CANCELLED");
    expect(minAvailable(await availabilityForProduct(db, product.id, date(10), date(11)))).toBe(10);
  });
});

describe("accès", () => {
  it("un client ne peut pas payer la réservation d'un autre", async () => {
    const a = await makeLender(base.city.id);
    const product = await makeProduct(a.lender.id, base.category.id, base.city.id);
    const c1 = await makeClient("Un");
    const c2 = await makeClient("Deux");
    const { reservation } = await bookAndPay(c1, [{ productId: product.id, quantity: 1, start: 10, end: 11 }], { pay: false });
    await expect(initiatePayment(c2.actor, { reservationId: reservation.id, method: "WAVE", idempotencyKey: randomUUID() })).rejects.toBeInstanceOf(AppError);
  });
});
