import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { invalidateSettings, validateSettingValue } from "@/lib/settings";
import { addToCart, getCart } from "@/services/cart";
import { searchProducts } from "@/services/catalog";
import { stockOverview } from "@/services/products";
import { createHold, holdInput } from "@/services/holds";
import { createReservationFromHold } from "@/services/reservations";
import { initiatePayment, simulatePayment } from "@/services/payments";
import { createQuote, payQuote, type QuoteData } from "@/services/quotes";
import type { InvoiceData } from "@/services/invoices";
import { snapshotTerms, termsVersion } from "@/services/order-snapshot";
import { deliveryUpdate, updateDelivery } from "@/services/deliveries";
import { approveModification, payModification, requestModification } from "@/services/modifications";
import { date, day, makeBase, makeClient, makeLender, makeProduct, resetDb } from "./helpers";

let base: Awaited<ReturnType<typeof makeBase>>;
beforeEach(async () => { await resetDb(); base = await makeBase(); });

async function setup() {
  const lender = await makeLender(base.city.id, { name: "AuditLoueur" });
  const product = await makeProduct(lender.lender.id, base.category.id, base.city.id);
  const client = await makeClient("AuditClient");
  await addToCart(client.user.id, { productId: product.id, quantity: 1, startDate: day(10), endDate: day(11) });
  return { lender, product, client };
}
const delivery = () => ({ fulfillmentType: "DELIVERY" as const, deliveryAddress: "Cocody", deliveryCityId: base.city.id, deliverySlot: "14:00-16:00" as const, returnSlot: "08:00-10:00" as const });
async function pay(client: Awaited<ReturnType<typeof makeClient>>, holdId: string) {
  const r = await createReservationFromHold(client.user.id, holdId);
  const { payment } = await initiatePayment(client.actor, { reservationId: r.id, method: "WAVE", idempotencyKey: randomUUID() });
  await simulatePayment(client.actor, payment.id, "success");
  return db.reservation.findUniqueOrThrow({ where: { id: r.id }, include: { items: true, deliveries: true } });
}
async function applyMod(client: Awaited<ReturnType<typeof makeClient>>, lender: Awaited<ReturnType<typeof makeLender>>, reservationId: string, input: Parameters<typeof requestModification>[2]) {
  const mod = await requestModification(client.actor, reservationId, input);
  await approveModification(lender.actor, reservationId, mod.id);
  if (mod.differenceToPay > 0) {
    const p = await payModification(client.actor, reservationId, mod.id, "WAVE", randomUUID());
    await simulatePayment(client.actor, p.id, "success");
  }
  return mod;
}

describe("coherence des proformas, consentements et livraisons", () => {
  it("A1 : reprise retrait vers proforma livree conserve son montant et sa livraison", async () => {
    const { client } = await setup();
    const quote = await createQuote(client.user.id, delivery());
    const oldHold = await createHold(client.user.id, { fulfillmentType: "PICKUP", acceptTerms: true, replaceExisting: true });
    await createReservationFromHold(client.user.id, oldHold.id);
    const h = await payQuote(client.user.id, quote.id, { accept: true });
    const r = await pay(client, h.id);
    expect(h.id).not.toBe(oldHold.id);
    expect((await db.hold.findUniqueOrThrow({ where: { id: oldHold.id } })).status).toBe("RELEASED");
    expect(r.total).toBe(quote.total);
    expect(r.fulfillmentType).toBe("DELIVERY");
    expect(r.deliveries).toHaveLength(1);
  });

  it("A2 : reprise du meme hold reporte les nouveaux creneaux dans Delivery", async () => {
    const { client } = await setup();
    const h = await createHold(client.user.id, { ...delivery(), acceptTerms: true, replaceExisting: true });
    await createReservationFromHold(client.user.id, h.id);
    const newer = await createHold(client.user.id, { ...delivery(), deliverySlot: "18:00-20:00", returnSlot: "16:00-18:00", acceptTerms: true, replaceExisting: true });
    const r = await pay(client, newer.id);

    expect(r.deliveries[0].slotStart).toBe("18:00");
  });

  it("A3 : refuse une valeur de remboursement modifiee depuis la proforma", async () => {
    const { client, product } = await setup();
    const quote = await createQuote(client.user.id, { fulfillmentType: "PICKUP" });
    await db.product.update({ where: { id: product.id }, data: { refundPrice: 90000 } });
    await expect(payQuote(client.user.id, quote.id, { accept: true })).rejects.toMatchObject({ code: "PRICE_CHANGED" });
    expect(await db.reservation.count()).toBe(0);
  });

  it("A4 : la facture contient les conditions acceptees sur la proforma", async () => {
    const { lender, client } = await setup();
    await db.lender.update({ where: { id: lender.lender.id }, data: { terms: "CONDITIONS VERSION A" } });
    const quote = await createQuote(client.user.id, { fulfillmentType: "PICKUP" });
    const h = await payQuote(client.user.id, quote.id, { accept: true });
    const r = await createReservationFromHold(client.user.id, h.id);
    const { payment } = await initiatePayment(client.actor, { reservationId: r.id, method: "WAVE", idempotencyKey: randomUUID() });
    await db.lender.update({ where: { id: lender.lender.id }, data: { terms: "CONDITIONS VERSION B" } });
    await simulatePayment(client.actor, payment.id, "success");
    const invoice = await db.invoice.findFirstOrThrow({ where: { reservationId: r.id, kind: "RENTAL" } });
    expect((invoice.data as unknown as InvoiceData).terms).toBe((quote.data as unknown as QuoteData).groups[0].terms);
  });

  it("A5 : le serveur refuse le paiement sans acceptation des conditions", async () => {
    const { client } = await setup();
    const parsed = holdInput.parse({ fulfillmentType: "PICKUP" });
    const h = await createHold(client.user.id, parsed);
    const r = await createReservationFromHold(client.user.id, h.id);
    await expect(initiatePayment(client.actor, { reservationId: r.id, method: "WAVE", idempotencyKey: randomUUID() })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("A6 : refuse l'ajout d'un nouveau loueur sans nouvelle commande", async () => {
    const { client } = await setup();
    const h = await createHold(client.user.id, { fulfillmentType: "PICKUP", acceptTerms: true, replaceExisting: true });
    const r = await pay(client, h.id);
    const second = await makeLender(base.city.id, { name: "LivraisonObligatoire" });
    await db.lender.update({ where: { id: second.lender.id }, data: { deliveryRequired: true } });
    const product = await makeProduct(second.lender.id, base.category.id, base.city.id);
    await expect(requestModification(client.actor, r.id, { lines: [{ action: "ADD", productId: product.id, quantity: 1, startDate: day(10), endDate: day(11) }] })).rejects.toMatchObject({ code: "MODIFICATION_NOT_ALLOWED" });
    expect(await db.reservationItem.count({ where: { reservationId: r.id } })).toBe(1);
  });

  it("A7 : changement de dates recalcule la planification de livraison", async () => {
    const { client, lender } = await setup();
    const h = await createHold(client.user.id, { ...delivery(), acceptTerms: true, replaceExisting: true });
    const r = await pay(client, h.id);
    await applyMod(client, lender, r.id, { lines: [{ action: "UPDATE", itemId: r.items[0].id, startDate: day(13), endDate: day(14) }] });
    const result = await db.reservation.findUniqueOrThrow({ where: { id: r.id }, include: { items: true, deliveries: true } });

    expect(result.deliveries[0].scheduledDate?.toISOString().slice(0,10)).toBe(day(13));
    expect(result.deliveries[0].returnDate?.toISOString().slice(0,10)).toBe(day(14));
  });

  it("A8 : garde le stock indisponible le jour du retour, sans changer le prix", async () => {
    const { client, product } = await setup();
    await db.product.update({ where: { id: product.id }, data: { stockQuantity: 1 } });
    const h = await createHold(client.user.id, { ...delivery(), returnSlot: "18:00-20:00", acceptTerms: true, replaceExisting: true });
    const r = await pay(client, h.id);
    expect(r.items[0].days).toBe(1);
    expect(r.items[0].subtotal).toBe(product.unitPrice);
    const second = await makeClient("DeuxiemeClient");
    await expect(addToCart(second.user.id, { productId: product.id, quantity: 1, startDate: day(11), endDate: day(12) })).rejects.toMatchObject({ code: "STOCK_INSUFFICIENT" });
    await expect(addToCart(second.user.id, { productId: product.id, quantity: 1, startDate: day(12), endDate: day(13) })).resolves.toBeTruthy();
  });

  it("A9 : refuse des variations de prix compensees entre lignes", async () => {
    const { client, lender, product } = await setup();
    const second = await makeProduct(lender.lender.id, base.category.id, base.city.id);
    await addToCart(client.user.id, { productId: second.id, quantity: 1, startDate: day(10), endDate: day(11) });
    const quote = await createQuote(client.user.id, { fulfillmentType: "PICKUP" });
    await db.product.update({ where: { id: product.id }, data: { unitPrice: 1500 } });
    await db.product.update({ where: { id: second.id }, data: { unitPrice: 500 } });
    await expect(payQuote(client.user.id, quote.id, { accept: true })).rejects.toMatchObject({ code: "PRICE_CHANGED" });
  });

  it("A10 : preuve du blocage d'un panier retrait uniquement et livraison obligatoire", async () => {
    const { client, lender } = await setup();
    await db.lender.update({ where: { id: lender.lender.id }, data: { deliveryRequired: true } });
    const second = await makeLender(base.city.id, { delivery: false });
    const product = await makeProduct(second.lender.id, base.category.id, base.city.id);
    await addToCart(client.user.id, { productId: product.id, quantity: 1, startDate: day(10), endDate: day(11) });
    await expect(createQuote(client.user.id, { fulfillmentType: "PICKUP" })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(createQuote(client.user.id, delivery())).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("refuse de remplacer une commande dont le paiement est en cours", async () => {
    const { client } = await setup();
    const h = await createHold(client.user.id, { ...delivery(), acceptTerms: true, replaceExisting: true });
    const r = await createReservationFromHold(client.user.id, h.id);
    await initiatePayment(client.actor, { reservationId: r.id, method: "WAVE", idempotencyKey: randomUUID() });
    await expect(createHold(client.user.id, { ...delivery(), deliveryAddress: "Autre adresse", acceptTerms: true, replaceExisting: true })).rejects.toMatchObject({ code: "CONFLICT" });
    expect((await db.hold.findUniqueOrThrow({ where: { id: h.id } })).deliveryAddress).toBe("Cocody");
    expect(await db.payment.count()).toBe(1);
  });

  it("conserve le meme consentement et la meme reservation sur une reprise identique", async () => {
    const { client } = await setup();
    const input = { ...delivery(), acceptTerms: true, replaceExisting: true };
    const h = await createHold(client.user.id, input);
    const r = await createReservationFromHold(client.user.id, h.id);
    const again = await createHold(client.user.id, input);
    expect(again.id).toBe(h.id);
    expect(again.termsAcceptedAt).toEqual(h.termsAcceptedAt);
    expect((await createReservationFromHold(client.user.id, again.id)).id).toBe(r.id);
  });

  it("refuse des conditions changees depuis l'affichage du formulaire", async () => {
    const { client, lender } = await setup();
    const version = termsVersion(snapshotTerms([lender.lender]));
    await db.lender.update({ where: { id: lender.lender.id }, data: { terms: "Nouvelles conditions" } });
    await expect(createHold(client.user.id, { ...delivery(), termsVersion: version, acceptTerms: true, replaceExisting: true })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await db.hold.count()).toBe(0);
  });

  it("refuse une nouvelle valeur de remboursement entre le HOLD et la reservation", async () => {
    const { client, product } = await setup();
    const quote = await createQuote(client.user.id, delivery());
    const h = await payQuote(client.user.id, quote.id, { accept: true });
    await db.product.update({ where: { id: product.id }, data: { refundPrice: 90000 } });
    await expect(createReservationFromHold(client.user.id, h.id)).rejects.toMatchObject({ code: "PRICE_CHANGED" });
  });

  it("refuse une ancienne proforma sans empreinte et preserve son document", async () => {
    const { client } = await setup();
    const quote = await createQuote(client.user.id, delivery());
    const data = quote.data as unknown as QuoteData;
    delete data.pricingFingerprint;
    await db.quote.update({ where: { id: quote.id }, data: { data: data as never } });
    await expect(payQuote(client.user.id, quote.id, { accept: true })).rejects.toMatchObject({ code: "PRICE_CHANGED" });
    expect((await db.quote.findUniqueOrThrow({ where: { id: quote.id } })).number).toBe(quote.number);
  });

  it("refuse la conversion d'un HOLD expire meme si sa reservation existe", async () => {
    const { client } = await setup();
    const h = await createHold(client.user.id, { ...delivery(), acceptTerms: true, replaceExisting: true });
    await createReservationFromHold(client.user.id, h.id);
    await db.hold.update({ where: { id: h.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await expect(createReservationFromHold(client.user.id, h.id)).rejects.toMatchObject({ code: "HOLD_EXPIRED" });
  });

  it("rembourse le complement si les conditions de remise changent avant son webhook", async () => {
    const { client, lender } = await setup();
    const h = await createHold(client.user.id, { fulfillmentType: "PICKUP", acceptTerms: true, replaceExisting: true });
    const r = await pay(client, h.id);
    const product = await makeProduct(lender.lender.id, base.category.id, base.city.id);
    const mod = await requestModification(client.actor, r.id, { lines: [{ action: "ADD", productId: product.id, quantity: 1, startDate: day(10), endDate: day(11) }] });
    await approveModification(lender.actor, r.id, mod.id);
    const p = await payModification(client.actor, r.id, mod.id, "WAVE", randomUUID());
    await db.lender.update({ where: { id: lender.lender.id }, data: { deliveryRequired: true } });
    await simulatePayment(client.actor, p.id, "success");
    expect((await db.modificationRequest.findUniqueOrThrow({ where: { id: mod.id } })).status).toBe("CANCELLED");
    expect((await db.payment.findUniqueOrThrow({ where: { id: p.id } })).status).toBe("REFUNDED");
    expect(await db.reservationItem.count({ where: { reservationId: r.id } })).toBe(1);
    expect((await db.refund.findFirstOrThrow({ where: { paymentId: p.id } })).amount).toBe(p.amount);
  });

  it("valide les heures et interdit une replanification hors de la periode reservee", async () => {
    expect(deliveryUpdate.safeParse({ slotStart: "99:99" }).success).toBe(false);
    const { client, lender } = await setup();
    const h = await createHold(client.user.id, { ...delivery(), acceptTerms: true, replaceExisting: true });
    const r = await pay(client, h.id);
    const id = r.deliveries[0].id;
    await expect(updateDelivery(lender.actor, id, { slotStart: "18:00", slotEnd: "10:00" })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(updateDelivery(lender.actor, id, { returnDate: day(15) })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await updateDelivery(lender.actor, id, { returnSlotStart: "16:00", returnSlotEnd: "18:00" });
    expect((await db.delivery.findUniqueOrThrow({ where: { id } })).returnSlotStart).toBe("16:00");
  });

  it("reprend un paiement deja initie avant la migration sans en creer un autre", async () => {
    const { client } = await setup();
    const h = await createHold(client.user.id, { ...delivery(), acceptTerms: true, replaceExisting: true });
    const r = await createReservationFromHold(client.user.id, h.id);
    const first = await initiatePayment(client.actor, { reservationId: r.id, method: "WAVE", idempotencyKey: randomUUID() });
    await db.reservation.update({ where: { id: r.id }, data: { termsSnapshot: Prisma.DbNull } });
    const again = await initiatePayment(client.actor, { reservationId: r.id, method: "WAVE", idempotencyKey: randomUUID() });
    expect(again.payment.id).toBe(first.payment.id);
    expect(await db.payment.count()).toBe(1);
  });

  it("reprend le panier sans compter son propre HOLD une seconde fois", async () => {
    const { client, product } = await setup();
    await db.product.update({ where: { id: product.id }, data: { stockQuantity: 1 } });
    await createHold(client.user.id, { ...delivery(), acceptTerms: true, replaceExisting: true });
    expect((await getCart(client.user.id)).issues).toBe(0);
    await expect(createQuote(client.user.id, delivery())).resolves.toBeTruthy();
  });

  it("controle la marge de retour configurable jusque dans le catalogue", async () => {
    expect(() => validateSettingValue("booking.return_buffer_days", 0)).toThrow();
    await db.setting.update({ where: { key: "booking.return_buffer_days" }, data: { value: 3 } });
    invalidateSettings();
    const { client, product } = await setup();
    await db.product.update({ where: { id: product.id }, data: { stockQuantity: 1 } });
    await createHold(client.user.id, { ...delivery(), acceptTerms: true, replaceExisting: true });
    const second = await makeClient("AutrePeriode");
    await expect(addToCart(second.user.id, { productId: product.id, quantity: 1, startDate: day(13), endDate: day(14) })).rejects.toMatchObject({ code: "STOCK_INSUFFICIENT" });
    const catalog = await searchProducts({ start: date(8), end: date(9), availableOnly: true });
    expect(catalog.items.some((p) => p.id === product.id)).toBe(false);
    await expect(addToCart(second.user.id, { productId: product.id, quantity: 1, startDate: day(14), endDate: day(15) })).resolves.toBeTruthy();
  });

  it("le stock du loueur inclut les articles a recuperer aujourd'hui", async () => {
    const { client, product, lender } = await setup();
    const h = await createHold(client.user.id, { ...delivery(), acceptTerms: true, replaceExisting: true });
    const r = await pay(client, h.id);
    await db.reservationItem.update({ where: { id: r.items[0].id }, data: { startDate: date(-1), endDate: date(0) } });
    const row = (await stockOverview(lender.lender.id)).find((p) => p.id === product.id)!;
    expect(row.reserved).toBe(1);
    expect(row.available).toBe(product.stockQuantity - 1);
  });

  it("serialise les doubles clics sur proforma, reservation et paiement", async () => {
    const { client } = await setup();
    const quote = await createQuote(client.user.id, delivery());
    const holds = await Promise.all([1, 2].map(() => payQuote(client.user.id, quote.id, { accept: true })));
    expect(holds[0].id).toBe(holds[1].id);
    const reservations = await Promise.all(holds.map((h) => createReservationFromHold(client.user.id, h.id)));
    expect(reservations[0].id).toBe(reservations[1].id);
    const payments = await Promise.all(reservations.map((r) => initiatePayment(client.actor, { reservationId: r.id, method: "WAVE", idempotencyKey: randomUUID() })));
    expect(payments[0].payment.id).toBe(payments[1].payment.id);
    expect(await db.payment.count()).toBe(1);
  });

  it("restitue la reservation deja payee lors d'une requete de conversion rejouee", async () => {
    const { client } = await setup();
    const h = await createHold(client.user.id, { ...delivery(), acceptTerms: true, replaceExisting: true });
    const r = await pay(client, h.id);
    expect((await createReservationFromHold(client.user.id, h.id)).id).toBe(r.id);
    expect(await db.reservation.count()).toBe(1);
    expect(await db.payment.count()).toBe(1);
  });
});
