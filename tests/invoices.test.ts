import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { transaction } from "@/lib/db";
import { lenderAdvance } from "@/services/reservations";
import { cancelReservation } from "@/services/refunds";
import { acknowledgeReport, createReturnReport } from "@/services/returns";
import { reportCashUnpaid } from "@/services/cash";
import { approveModification, payModification, requestModification } from "@/services/modifications";
import { simulatePayment } from "@/services/payments";
import { getDamageStatementForActor, getInvoiceForActor, issueRentalInvoices, listInvoices, splitVat, type InvoiceData } from "@/services/invoices";
import { bookAndPay } from "./flow";
import { day, makeAdmin, makeBase, makeClient, makeLender, makeProduct, resetDb } from "./helpers";

let base: Awaited<ReturnType<typeof makeBase>>;
beforeEach(async () => {
  await resetDb();
  base = await makeBase();
});

const year = new Date().getUTCFullYear();

/** Commande avec deux loueurs : A assujetti à la TVA et payé en ligne, B en acompte + espèces. */
async function mixed(opts: { start?: number; end?: number } = {}) {
  const a = await makeLender(base.city.id, { name: "Alpha" });
  await db.lender.update({ where: { id: a.lender.id }, data: { vatRegistered: true, taxNumber: "1234567A", rccm: "CI-ABJ-2024-B-1" } });
  const b = await makeLender(base.city.id, { name: "Bravo" });
  await db.lender.update({ where: { id: b.lender.id }, data: { cashModeAllowed: true, paymentMode: "DEPOSIT_CASH" } });
  const pa = await makeProduct(a.lender.id, base.category.id, base.city.id, { unitPrice: 10_000, deposit: 5_000 });
  const pb = await makeProduct(b.lender.id, base.category.id, base.city.id, { unitPrice: 50_000, deposit: 30_000 });
  const client = await makeClient();
  const start = opts.start ?? 10;
  const booked = await bookAndPay(client, [{ productId: pa.id, quantity: 1, start, end: opts.end ?? start + 2 }, { productId: pb.id, quantity: 1, start, end: opts.end ?? start + 2 }]);
  return { a, b, client, booked, reservationId: booked.reservation.id, itemA: booked.reservation.items.find((i) => i.lenderId === a.lender.id)!, itemB: booked.reservation.items.find((i) => i.lenderId === b.lender.id)! };
}

const rentalOf = (reservationId: string, lenderId: string) => db.invoice.findFirstOrThrow({ where: { reservationId, lenderId, kind: "RENTAL" } });

describe("facturation", () => {
  it("extrait la TVA d'un montant TTC", () => {
    expect(splitVat(11_800, 1800)).toEqual({ totalHt: 10_000, vatAmount: 1_800 });
    expect(splitVat(20_000, 1800)).toEqual({ totalHt: 16_949, vatAmount: 3_051 });
    expect(splitVat(20_000, 0)).toEqual({ totalHt: 20_000, vatAmount: 0 });
  });

  it("paiement confirmé : une facture de location par loueur, numérotation continue, TVA selon le loueur", async () => {
    const { a, b, client, reservationId } = await mixed();
    const invoices = await db.invoice.findMany({ where: { reservationId }, orderBy: { number: "asc" } });
    expect(invoices.map((i) => i.number)).toEqual([`F-${year}-000001`, `F-${year}-000002`]);

    const fa = await rentalOf(reservationId, a.lender.id);
    expect(fa).toMatchObject({ totalTtc: 20_000, vatRateBps: 1800, totalHt: 16_949, vatAmount: 3_051 });
    const da = fa.data as unknown as InvoiceData;
    expect(da.seller).toMatchObject({ name: "Alpha", ncc: "1234567A", vatRegistered: true });
    expect(da.deposit).toBe(5_000);
    expect(da.settlement).toMatchObject({ paymentMode: "ONLINE_FULL", onlineAmount: 20_000, cashAmount: 0 });

    const fb = await rentalOf(reservationId, b.lender.id);
    expect(fb).toMatchObject({ totalTtc: 100_000, vatRateBps: 0, vatAmount: 0 });
    expect((fb.data as unknown as InvoiceData).settlement).toMatchObject({ paymentMode: "DEPOSIT_CASH", onlineAmount: 10_000, cashAmount: 90_000 });
    expect(await db.notification.count({ where: { userId: client.user.id, type: "invoice.issued" } })).toBe(1);

    // Idempotence : réémettre ne crée rien et ne consomme aucun numéro.
    await transaction((tx) => issueRentalInvoices(tx, reservationId, fa.paymentId!));
    expect(await db.invoice.count()).toBe(2);
    expect((await db.invoiceSequence.findUniqueOrThrow({ where: { key: `F-${year}` } })).last).toBe(2);
  });

  it("annulation à 50 % : avoir de la part remboursée, et du solde en espèces qui ne sera pas payé", async () => {
    const { a, b, reservationId } = await mixed();
    const admin = await makeAdmin();
    await cancelReservation(admin.actor, reservationId, { reason: "Événement reporté", refundPercent: 50 });
    const credits = await db.invoice.findMany({ where: { reservationId, kind: "CREDIT_NOTE" }, orderBy: { number: "asc" } });
    expect(credits.map((c) => c.number)).toEqual([`AV-${year}-000001`, `AV-${year}-000002`]);
    const ca = credits.find((c) => c.lenderId === a.lender.id)!;
    const cb = credits.find((c) => c.lenderId === b.lender.id)!;
    expect(ca).toMatchObject({ totalTtc: 10_000, vatRateBps: 1800, creditedInvoiceId: (await rentalOf(reservationId, a.lender.id)).id });
    expect(cb.totalTtc).toBe(5_000 + 90_000); // moitié de l'acompte remboursée + solde en espèces annulé
  });

  it("solde en espèces impayé : avoir du solde, l'acompte reste facturé", async () => {
    const { b, reservationId } = await mixed({ start: 0, end: 2 });
    await lenderAdvance(b.actor, reservationId, "READY");
    await reportCashUnpaid(b.actor, reservationId, "Client absent à la remise");
    const credit = await db.invoice.findFirstOrThrow({ where: { reservationId, lenderId: b.lender.id, kind: "CREDIT_NOTE" } });
    expect(credit.totalTtc).toBe(90_000);
  });

  it("modification : facture du supplément, puis avoir d'une baisse", async () => {
    const l = await makeLender(base.city.id);
    const p = await makeProduct(l.lender.id, base.category.id, base.city.id, { unitPrice: 1_000, deposit: 1_000, stock: 20 });
    const client = await makeClient();
    const { reservation } = await bookAndPay(client, [{ productId: p.id, quantity: 4, start: 10, end: 12 }]);
    const item = reservation.items[0];

    const up = await requestModification(client.actor, reservation.id, { lines: [{ action: "UPDATE", itemId: item.id, quantity: 6 }] });
    await approveModification(l.actor, reservation.id, up.id);
    const pay = await payModification(client.actor, reservation.id, up.id, "WAVE", randomUUID());
    await simulatePayment(client.actor, pay.id, "success");
    const extra = await db.invoice.findFirstOrThrow({ where: { sourceKey: `MOD:${up.id}` } });
    expect(extra).toMatchObject({ kind: "RENTAL", totalTtc: 4_000, number: `F-${year}-000002` });

    const down = await requestModification(client.actor, reservation.id, { lines: [{ action: "UPDATE", itemId: item.id, quantity: 3 }] });
    await approveModification(l.actor, reservation.id, down.id);
    const credit = await db.invoice.findFirstOrThrow({ where: { sourceKey: `CREDIT:MOD:${down.id}` } });
    expect(credit).toMatchObject({ kind: "CREDIT_NOTE", totalTtc: 6_000 });
  });

  it("casse et perte : constat provisoire, puis facture définitive quand le client l'accepte", async () => {
    const l = await makeLender(base.city.id);
    const p = await makeProduct(l.lender.id, base.category.id, base.city.id, { unitPrice: 10_000, deposit: 20_000, refundPrice: 15_000 });
    const client = await makeClient();
    const { reservation } = await bookAndPay(client, [{ productId: p.id, quantity: 2, start: 0, end: 2 }]);
    const item = reservation.items[0];
    await lenderAdvance(l.actor, reservation.id, "READY");
    await lenderAdvance(l.actor, reservation.id, "IN_USE");
    await createReturnReport(l.actor, item.id, { returnedQuantity: 1, lostQuantity: 1, damagedQuantity: 1, condition: "DAMAGED", damageAmount: 3_000 }, [{ key: "private/returns/x.jpg", mimeType: "image/jpeg" }]);

    const provisional = await getDamageStatementForActor(client.actor, item.id);
    expect(provisional.invoice).toBeNull();
    expect(await db.invoice.count({ where: { kind: "DAMAGE" } })).toBe(0);

    await acknowledgeReport(client.actor, item.id);
    const invoice = await db.invoice.findFirstOrThrow({ where: { kind: "DAMAGE", reservationId: reservation.id } });
    expect(invoice).toMatchObject({ totalTtc: 18_000, vatRateBps: 0 });
    const data = invoice.data as unknown as InvoiceData;
    expect(data.lines.map((x) => x.amount)).toEqual([15_000, 3_000]);
    expect(data.damage).toMatchObject({ depositAmount: 40_000, withheld: 18_000, released: 22_000, extraCharge: 0, photos: ["private/returns/x.jpg"] });
    expect((await getDamageStatementForActor(client.actor, item.id)).invoice?.id).toBe(invoice.id);
  });

  it("droits : chacun ne voit que ses documents", async () => {
    const { a, b, client, reservationId } = await mixed();
    const fa = await rentalOf(reservationId, a.lender.id);
    await expect(getInvoiceForActor(client.actor, fa.id)).resolves.toBeTruthy();
    await expect(getInvoiceForActor(a.actor, fa.id)).resolves.toBeTruthy();
    await expect(getInvoiceForActor(b.actor, fa.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    const other = await makeClient("Autre");
    await expect(getInvoiceForActor(other.actor, fa.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect((await listInvoices(b.actor)).rows.every((i) => i.lenderId === b.lender.id)).toBe(true);
    expect((await listInvoices(client.actor)).total).toBe(2);
    const admin = await makeAdmin();
    expect((await listInvoices(admin.actor, { q: "Alpha" })).total).toBe(1);
    void day;
  });
});
