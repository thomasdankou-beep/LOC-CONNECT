import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { addToCart } from "@/services/cart";
import { createReservationFromHold } from "@/services/reservations";
import { createHold } from "@/services/holds";
import { initiatePayment, simulatePayment } from "@/services/payments";
import { createQuote, getQuoteForActor, listQuotes, payQuote, type QuoteData } from "@/services/quotes";
import type { InvoiceData } from "@/services/invoices";
import { day, makeAdmin, makeBase, makeClient, makeLender, makeProduct, resetDb } from "./helpers";

let base: Awaited<ReturnType<typeof makeBase>>;
beforeEach(async () => {
  await resetDb();
  base = await makeBase();
});

const year = new Date().getUTCFullYear();

/** Panier de type « Leako » : deux comptoirs chez un même loueur, livrés à Abidjan. */
async function cartWithCounters() {
  const l = await makeLender(base.city.id, { name: "Leako" });
  await db.lender.update({ where: { id: l.lender.id }, data: { shareCapital: 1_000_000, postalAddress: "18 BP 1470 Abidjan 18", rccm: "CI-ABJ-2018-B-03065", terms: "Le bien est loué pour 24 heures.\nAcompte de 50 % à la commande." } });
  const trio = await makeProduct(l.lender.id, base.category.id, base.city.id, { name: "Le comptoir trio", unitPrice: 120_000, deposit: 30_000, refundPrice: 250_000, stock: 2 });
  const duo = await makeProduct(l.lender.id, base.category.id, base.city.id, { name: "Le comptoir duo", unitPrice: 50_000, deposit: 20_000, refundPrice: 175_000, stock: 2 });
  const client = await makeClient("Molly");
  await addToCart(client.user.id, { productId: trio.id, quantity: 1, startDate: day(10), endDate: day(11) });
  await addToCart(client.user.id, { productId: duo.id, quantity: 1, startDate: day(10), endDate: day(11) });
  const input = { fulfillmentType: "DELIVERY" as const, deliveryAddress: "Parc des expositions", deliveryCityId: base.city.id, contactPhone: "+225 07 00 00 00 00", deliverySlot: "14:00-16:00" as const, returnSlot: "08:00-10:00" as const, eventName: "STORY FOAM" };
  return { l, trio, duo, client, input };
}

async function payHold(client: Awaited<ReturnType<typeof makeClient>>, holdId: string) {
  const reservation = await createReservationFromHold(client.user.id, holdId);
  const { payment } = await initiatePayment(client.actor, { reservationId: reservation.id, method: "WAVE", idempotencyKey: randomUUID() });
  await simulatePayment(client.actor, payment.id, "success");
  return db.reservation.findUniqueOrThrow({ where: { id: reservation.id }, include: { deliveries: true } });
}

describe("proforma", () => {
  it("chiffre le panier : prix de remboursement, transport, caution, net à payer et créneaux", async () => {
    const { client, input } = await cartWithCounters();
    const quote = await createQuote(client.user.id, input);
    expect(quote.number).toBe(`PF-${year}-000001`);

    const data = quote.data as unknown as QuoteData;
    expect(data.groups).toHaveLength(1);
    const [g] = data.groups;
    expect(g.seller.name).toBe("Leako");
    expect(g.lines.map((x) => [x.label, x.unitPrice, x.refundPrice, x.amount])).toEqual([
      ["Le comptoir trio", 120_000, 250_000, 120_000],
      ["Le comptoir duo", 50_000, 175_000, 50_000],
      ["Transport (livraison et récupération)", 3_000, undefined, 3_000],
    ]);
    expect(data.totals).toEqual({ rental: 170_000, delivery: 3_000, totalRental: 173_000, deposit: 50_000, netToPay: 223_000, online: 223_000, cash: 0 });
    expect(quote).toMatchObject({ total: 223_000, netToPay: 223_000 });
    expect(data.schedule).toEqual({ outDate: day(10), outSlot: "14:00-16:00", backDate: day(11), backSlot: "08:00-10:00" });
    expect(data.buyer).toMatchObject({ name: "Molly Test", phone: "+225 07 00 00 00 00", event: "STORY FOAM" });
    expect(g.seller).toMatchObject({ shareCapital: 1_000_000, postalAddress: "18 BP 1470 Abidjan 18", rccm: "CI-ABJ-2018-B-03065" });
    expect(g.terms).toContain("24 heures");

    // Le panier reste intact : la proforma n'est qu'un document.
    expect(await db.cartItem.count({ where: { cart: { userId: client.user.id } } })).toBe(2);
    expect((await getQuoteForActor(client.actor, quote.id)).status).toBe("OPEN");
  });

  it("payée depuis son lien : même montant, créneaux transmis à la livraison et à la facture, puis marquée payée", async () => {
    const { client, input } = await cartWithCounters();
    const quote = await createQuote(client.user.id, input);
    await db.cartItem.deleteMany({ where: { cart: { userId: client.user.id } } });

    const hold = await payQuote(client.user.id, quote.id, { accept: true });
    expect(hold).toMatchObject({ quoteId: quote.id, deliverySlot: "14:00-16:00", returnSlot: "08:00-10:00", fulfillmentType: "DELIVERY" });
    const reservation = await payHold(client, hold.id);
    expect(reservation).toMatchObject({ quoteId: quote.id, total: quote.total, status: "CONFIRMED", deliverySlot: "14:00-16:00", returnSlot: "08:00-10:00" });
    expect(reservation.deliveries[0]).toMatchObject({ slotStart: "14:00", slotEnd: "16:00", returnSlotStart: "08:00", returnSlotEnd: "10:00" });
    expect(reservation.deliveries[0].returnDate?.toISOString().slice(0, 10)).toBe(day(11));

    const invoice = await db.invoice.findFirstOrThrow({ where: { reservationId: reservation.id, kind: "RENTAL" } });
    const data = invoice.data as unknown as InvoiceData;
    expect(data.schedule).toEqual({ outDate: day(10), outSlot: "14:00-16:00", backDate: day(11), backSlot: "08:00-10:00" });
    expect(data.lines.map((x) => x.refundPrice)).toEqual([250_000, 175_000, undefined]);
    // « Lu et approuvé » coché au paiement de la proforma : daté sur la proforma, la réservation et la facture.
    const paidQuote = await db.quote.findUniqueOrThrow({ where: { id: quote.id } });
    expect(paidQuote.acceptedAt).not.toBeNull();
    expect(reservation.termsAcceptedAt).not.toBeNull();
    expect(reservation.eventName).toBe("STORY FOAM");
    expect(data.acceptedAt).toBe(reservation.termsAcceptedAt!.toISOString());
    expect(data.terms).toContain("Acompte de 50 %");
    expect(data.buyer.event).toBe("STORY FOAM");
    expect(data.seller).toMatchObject({ shareCapital: 1_000_000, postalAddress: "18 BP 1470 Abidjan 18" });

    expect((await getQuoteForActor(client.actor, quote.id)).status).toBe("PAID");
    await expect(payQuote(client.user.id, quote.id, { accept: true })).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("refuse le paiement si les prix ont changé ou si la proforma a expiré", async () => {
    const { client, input, trio } = await cartWithCounters();
    const quote = await createQuote(client.user.id, input);
    await db.product.update({ where: { id: trio.id }, data: { unitPrice: 130_000 } });
    await expect(payQuote(client.user.id, quote.id, { accept: true })).rejects.toMatchObject({ code: "PRICE_CHANGED" });

    await db.product.update({ where: { id: trio.id }, data: { unitPrice: 120_000 } });
    await db.quote.update({ where: { id: quote.id }, data: { validUntil: new Date(Date.now() - 1000) } });
    await expect(payQuote(client.user.id, quote.id, { accept: true })).rejects.toMatchObject({ code: "QUOTE_EXPIRED" });
    expect((await getQuoteForActor(client.actor, quote.id)).status).toBe("EXPIRED");
  });

  it("un prix modifié entre le blocage et la réservation est aussi refusé", async () => {
    const { client, input, duo } = await cartWithCounters();
    const quote = await createQuote(client.user.id, input);
    const hold = await payQuote(client.user.id, quote.id, { accept: true });
    await db.product.update({ where: { id: duo.id }, data: { unitPrice: 40_000 } });
    await expect(createReservationFromHold(client.user.id, hold.id)).rejects.toMatchObject({ code: "PRICE_CHANGED" });
  });

  it("acompte et espèces : la proforma distingue le paiement en ligne et le solde au loueur", async () => {
    const { l, client, input } = await cartWithCounters();
    await db.lender.update({ where: { id: l.lender.id }, data: { cashModeAllowed: true, paymentMode: "DEPOSIT_CASH" } });
    const quote = await createQuote(client.user.id, input);
    const data = quote.data as unknown as QuoteData;
    expect(data.totals.netToPay).toBe(223_000);
    expect(data.totals.online + data.totals.cash).toBe(223_000);
    expect(data.totals.cash).toBeGreaterThan(0);
    expect(data.notes.some((n) => n.startsWith("Acompte de"))).toBe(true);
  });

  it("visible du client qui l'a demandée et de l'administration seulement", async () => {
    const { client, input } = await cartWithCounters();
    const quote = await createQuote(client.user.id, input);
    const other = await makeClient("Autre");
    await expect(getQuoteForActor(other.actor, quote.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(payQuote(other.user.id, quote.id, { accept: true })).rejects.toMatchObject({ code: "NOT_FOUND" });
    const admin = await makeAdmin();
    expect((await getQuoteForActor(admin.actor, quote.id)).quote.number).toBe(quote.number);
    expect(await listQuotes(other.actor)).toHaveLength(0);
    expect(await listQuotes(client.actor)).toHaveLength(1);
  });

  it("commande sans proforma : événement et « Lu et approuvé » passent du blocage à la facture", async () => {
    const { client } = await cartWithCounters();
    const hold = await createHold(client.user.id, { fulfillmentType: "PICKUP", eventName: "Mariage Kouadio", acceptTerms: true, replaceExisting: true });
    const reservation = await payHold(client, hold.id);
    expect(reservation.eventName).toBe("Mariage Kouadio");
    expect(reservation.termsAcceptedAt).not.toBeNull();
    const invoice = await db.invoice.findFirstOrThrow({ where: { reservationId: reservation.id, kind: "RENTAL" } });
    expect((invoice.data as unknown as InvoiceData).buyer.event).toBe("Mariage Kouadio");
  });

  it("livraison obligatoire chez le loueur : le retrait est refusé, la livraison est facturée", async () => {
    const { l, client, input } = await cartWithCounters();
    await db.lender.update({ where: { id: l.lender.id }, data: { deliveryRequired: true } });
    await expect(createQuote(client.user.id, { fulfillmentType: "PICKUP" })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    const hold = await createHold(client.user.id, { fulfillmentType: "PICKUP", acceptTerms: true, replaceExisting: true });
    await expect(createReservationFromHold(client.user.id, hold.id)).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    const quote = await createQuote(client.user.id, input);
    expect((quote.data as unknown as QuoteData).totals.delivery).toBe(3_000);
  });

  it("le paiement exige « Lu et approuvé »", async () => {
    const { client, input } = await cartWithCounters();
    const quote = await createQuote(client.user.id, input);
    await expect(payQuote(client.user.id, quote.id, { accept: false } as never)).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect((await db.quote.findUniqueOrThrow({ where: { id: quote.id } })).acceptedAt).toBeNull();
  });

  it("refuse un panier vide et la livraison sans adresse", async () => {
    const client = await makeClient();
    await expect(createQuote(client.user.id, { fulfillmentType: "PICKUP" })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    const { client: c2, input } = await cartWithCounters();
    await expect(createQuote(c2.user.id, { ...input, deliveryAddress: undefined })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });
});
