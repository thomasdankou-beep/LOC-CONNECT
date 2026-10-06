import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { depositFor } from "@/services/pricing";
import { updateSetting } from "@/services/admin";
import { approveModification, payModification, requestModification } from "@/services/modifications";
import { simulatePayment } from "@/services/payments";
import { addToCart, getCart } from "@/services/cart";
import { lenderAdvance } from "@/services/reservations";
import { contestReport, createReturnReport } from "@/services/returns";
import { bookAndPay } from "./flow";
import { day, makeAdmin, makeBase, makeClient, makeLender, makeProduct, resetDb } from "./helpers";

let base: Awaited<ReturnType<typeof makeBase>>;
let admin: Awaited<ReturnType<typeof makeAdmin>>;
beforeEach(async () => {
  await resetDb();
  base = await makeBase();
  admin = await makeAdmin();
  // Réglage par défaut de la plateforme : 30 % de la location de chaque loueur.
  await updateSetting(admin.actor, "deposit.mode", "PERCENT_OF_RENTAL");
  await updateSetting(admin.actor, "deposit.percent", 30);
});

describe("caution en pourcentage de la location", () => {
  it("calcule la caution d'une ligne", () => {
    expect(depositFor(100_000, 2, 50_000, 30)).toBe(30_000);
    expect(depositFor(1_001, 1, 0, 30)).toBe(300);
    expect(depositFor(100_000, 2, 50_000, null)).toBe(100_000);
  });

  it("panier multi-loueurs : 30 % du total de chaque loueur, figé sur la réservation", async () => {
    const a = await makeLender(base.city.id);
    const b = await makeLender(base.city.id);
    const pa = await makeProduct(a.lender.id, base.category.id, base.city.id, { unitPrice: 10_000, deposit: 99_999 });
    const pb1 = await makeProduct(b.lender.id, base.category.id, base.city.id, { unitPrice: 20_000, deposit: 99_999 });
    const pb2 = await makeProduct(b.lender.id, base.category.id, base.city.id, { unitPrice: 30_000, deposit: 99_999 });
    const client = await makeClient();
    const { reservation, payment } = await bookAndPay(client, [
      { productId: pa.id, quantity: 1, start: 5, end: 7 },
      { productId: pb1.id, quantity: 1, start: 5, end: 7 },
      { productId: pb2.id, quantity: 1, start: 5, end: 7 },
    ]);
    const byLender = (id: string) => reservation.items.filter((i) => i.lenderId === id).reduce((s, i) => s + i.depositAmount, 0);
    expect(byLender(a.lender.id)).toBe(6_000); // 30 % de 20 000
    expect(byLender(b.lender.id)).toBe(30_000); // 30 % de 40 000 + 60 000
    expect(reservation.items.every((i) => i.depositPercent === 30)).toBe(true);
    expect(reservation.depositTotal).toBe(36_000);
    expect(payment.amount).toBe(120_000 + 36_000);
    const deposits = await db.deposit.findMany({ where: { itemId: { in: reservation.items.map((i) => i.id) } } });
    expect(deposits.every((d) => d.status === "HELD")).toBe(true);
  });

  it("loueur en mode espèces : la caution de 30 % reste payée en ligne avec l'acompte", async () => {
    const b = await makeLender(base.city.id);
    await db.lender.update({ where: { id: b.lender.id }, data: { cashModeAllowed: true, paymentMode: "DEPOSIT_CASH" } });
    const p = await makeProduct(b.lender.id, base.category.id, base.city.id, { unitPrice: 50_000, deposit: 0 });
    const client = await makeClient();
    const { payment, reservation } = await bookAndPay(client, [{ productId: p.id, quantity: 1, start: 5, end: 7 }]);
    expect(reservation.depositTotal).toBe(30_000);
    expect(payment.amount).toBe(10_000 + 30_000);
    expect(reservation.cashTotal).toBe(90_000);
  });

  it("le panier affiche la caution en pourcentage", async () => {
    const l = await makeLender(base.city.id);
    const p = await makeProduct(l.lender.id, base.category.id, base.city.id, { unitPrice: 10_000, deposit: 99_999 });
    const client = await makeClient();
    await addToCart(client.user.id, { productId: p.id, quantity: 3, startDate: day(5), endDate: day(7) });
    const cart = await getCart(client.user.id);
    expect(cart.groups[0].deposit).toBe(18_000);
    expect(cart.total).toBe(60_000 + 18_000);
  });

  it("prolongation : la caution suit la nouvelle location, même si l'administration a changé de mode entre-temps", async () => {
    const l = await makeLender(base.city.id);
    const p = await makeProduct(l.lender.id, base.category.id, base.city.id, { unitPrice: 10_000, deposit: 99_999 });
    const client = await makeClient();
    const { reservation } = await bookAndPay(client, [{ productId: p.id, quantity: 1, start: 10, end: 12 }]);
    await updateSetting(admin.actor, "deposit.mode", "FIXED_PER_PRODUCT");

    const item = reservation.items[0];
    const mod = await requestModification(client.actor, reservation.id, { lines: [{ action: "UPDATE", itemId: item.id, endDate: day(13) }] });
    // Location 20 000 vers 30 000 ; caution 6 000 vers 9 000 : complément 13 000.
    expect(mod.depositAfter).toBe(9_000);
    expect(mod.differenceToPay).toBe(13_000);
    await approveModification(l.actor, reservation.id, mod.id);
    const pay = await payModification(client.actor, reservation.id, mod.id, "WAVE", randomUUID());
    await simulatePayment(client.actor, pay.id, "success");
    expect((await db.deposit.findUniqueOrThrow({ where: { itemId: item.id } })).amount).toBe(9_000);

    // Une nouvelle réservation suit le nouveau réglage : caution fixe du produit.
    const other = await bookAndPay(await makeClient("Autre"), [{ productId: p.id, quantity: 1, start: 20, end: 22 }]);
    expect(other.reservation.items[0].depositAmount).toBe(99_999);
    expect(other.reservation.items[0].depositPercent).toBeNull();
  });

  it("perte au-delà de la caution : retenue plafonnée, complément facturé, contestation possible", async () => {
    const l = await makeLender(base.city.id);
    const p = await makeProduct(l.lender.id, base.category.id, base.city.id, { unitPrice: 10_000, refundPrice: 200_000, extra: true });
    const client = await makeClient();
    const { reservation } = await bookAndPay(client, [{ productId: p.id, quantity: 1, start: 0, end: 2 }]);
    const item = reservation.items[0];
    expect(item.depositAmount).toBe(6_000);
    await lenderAdvance(l.actor, reservation.id, "READY");
    await lenderAdvance(l.actor, reservation.id, "IN_USE");
    const report = await createReturnReport(l.actor, item.id, { returnedQuantity: 0, lostQuantity: 1, damagedQuantity: 0, condition: "LOST" }, [{ key: "private/returns/x.jpg", mimeType: "image/jpeg" }]);
    expect(report.withheldAmount).toBe(6_000);
    expect(report.extraChargeAmount).toBe(194_000);
    const dispute = await contestReport(client.actor, item.id, "Le matériel a été rendu au livreur, j'ai un reçu.");
    expect(dispute.disputedAmount).toBe(200_000);
  });

  it("refuse un pourcentage supérieur à 100", async () => {
    await expect(updateSetting(admin.actor, "deposit.percent", 150)).rejects.toThrow();
  });
});
