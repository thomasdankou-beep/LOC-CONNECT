import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { cancellationPolicyInput, saveCancellationPolicy, setLenderCommission, updateSetting } from "@/services/admin";
import { previewCancellation, adminRefund } from "@/services/refunds";
import { contactInput, setContactHandled, submitContact } from "@/services/contact";
import { bookAndPay } from "./flow";
import { makeAdmin, makeBase, makeClient, makeLender, makeProduct, resetDb } from "./helpers";

let base: Awaited<ReturnType<typeof makeBase>>;
beforeEach(async () => {
  await resetDb();
  base = await makeBase();
});

describe("paramètres commerciaux configurables", () => {
  it("refuse une valeur invalide et conserve l'ancienne", async () => {
    const admin = await makeAdmin();
    await expect(updateSetting(admin.actor, "commission.rate_bps", -5)).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(updateSetting(admin.actor, "commission.refund_policy", "AUCUNE")).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(updateSetting(admin.actor, "parametre.inconnu", 1)).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect((await getSettings())["commission.rate_bps"]).toBe(1000);
  });

  it("applique une nouvelle commission aux nouvelles réservations sans toucher aux anciennes", async () => {
    const admin = await makeAdmin();
    const lender = await makeLender(base.city.id);
    const product = await makeProduct(lender.lender.id, base.category.id, base.city.id, { unitPrice: 10_000, stock: 20 });
    const client = await makeClient();

    const first = await bookAndPay(client, [{ productId: product.id, quantity: 1, start: 5, end: 6 }]);
    expect(first.reservation.items[0].commission).toBe(1000);

    await updateSetting(admin.actor, "commission.rate_bps", 2000);
    const second = await bookAndPay(client, [{ productId: product.id, quantity: 1, start: 8, end: 9 }]);
    expect(second.reservation.items[0].commission).toBe(2000);
    expect((await db.reservationItem.findUniqueOrThrow({ where: { id: first.reservation.items[0].id } })).commission).toBe(1000);

    await setLenderCommission(admin.actor, lender.lender.id, 500);
    const third = await bookAndPay(client, [{ productId: product.id, quantity: 1, start: 11, end: 12 }]);
    expect(third.reservation.items[0].commission).toBe(500);
  });

  it("réserve les paramètres aux administrateurs autorisés", async () => {
    const support = await makeAdmin("ADMIN_SUPPORT");
    await expect(updateSetting(support.actor, "commission.rate_bps", 1500)).rejects.toMatchObject({ code: "FORBIDDEN" });
    const client = await makeClient();
    await expect(updateSetting(client.actor, "commission.rate_bps", 1500)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("journalise chaque changement de paramètre", async () => {
    const admin = await makeAdmin();
    await updateSetting(admin.actor, "payout.freeze_hours", 24);
    const log = await db.auditLog.findFirstOrThrow({ where: { action: "setting.update", entityId: "payout.freeze_hours" } });
    expect(log.userId).toBe(admin.user.id);
    expect(log.newValue).toMatchObject({ value: 24 });
  });
});

describe("politique d'annulation configurable", () => {
  it("rejette des paliers dupliqués", () => {
    expect(() => cancellationPolicyInput.parse({ rules: [{ minHoursBefore: 24, refundPercent: 50 }, { minHoursBefore: 24, refundPercent: 10 }] })).toThrow();
  });

  it("modifie le remboursement des annulations futures", async () => {
    const admin = await makeAdmin();
    const lender = await makeLender(base.city.id);
    const product = await makeProduct(lender.lender.id, base.category.id, base.city.id, { unitPrice: 10_000, stock: 20 });
    const client = await makeClient();
    const booked = await bookAndPay(client, [{ productId: product.id, quantity: 1, start: 6, end: 8 }]);

    const before = await previewCancellation(client.actor, booked.reservation.id);
    expect(before.lines[0].percent).toBe(100);

    await saveCancellationPolicy(admin.actor, { rules: [{ minHoursBefore: 0, refundPercent: 20 }] });
    const after = await previewCancellation(client.actor, booked.reservation.id);
    expect(after.lines[0].percent).toBe(20);
    expect(after.lines[0].rentalRefund).toBe(4_000);
    expect(after.lines[0].depositRefund).toBe(booked.reservation.items[0].depositAmount);
  });
});

describe("remboursement exceptionnel", () => {
  it("est réservé à l'administration finance et plafonné par le paiement", async () => {
    const finance = await makeAdmin("ADMIN_FINANCE");
    const support = await makeAdmin("ADMIN_SUPPORT");
    const lender = await makeLender(base.city.id);
    const product = await makeProduct(lender.lender.id, base.category.id, base.city.id, { unitPrice: 10_000, stock: 20 });
    const client = await makeClient();
    const booked = await bookAndPay(client, [{ productId: product.id, quantity: 1, start: 5, end: 6 }]);

    await expect(adminRefund(support.actor, booked.payment.id, { amount: 1000, reason: "Geste commercial" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    const refund = await adminRefund(finance.actor, booked.payment.id, { amount: 10_000_000, reason: "Montant excessif" });
    expect(refund.amount).toBe(booked.payment.amount);
    await expect(adminRefund(finance.actor, booked.payment.id, { amount: 1, reason: "Déjà remboursé" })).rejects.toMatchObject({ code: "CONFLICT" });
  });
});

describe("formulaire de contact", () => {
  it("valide les champs et rejette les robots", () => {
    const ok = { name: "Awa Kouadio", email: "AWA@Example.com", subject: "Question", message: "Bonjour, une question sur ma caution." };
    expect(contactInput.parse(ok).email).toBe("awa@example.com");
    expect(() => contactInput.parse({ ...ok, message: "court" })).toThrow();
    expect(() => contactInput.parse({ ...ok, email: "pas-un-email" })).toThrow();
    expect(() => contactInput.parse({ ...ok, website: "http://spam.example" })).toThrow();
  });

  it("enregistre le message, notifie le support et se traite depuis l'administration", async () => {
    const support = await makeAdmin("ADMIN_SUPPORT");
    const { id } = await submitContact({ name: "Awa Kouadio", email: "awa@example.com", subject: "Caution", message: "Quand ma caution sera-t-elle restituée ?" });
    expect(await db.contactMessage.count()).toBe(1);
    expect(await db.notification.count({ where: { userId: support.user.id, type: "contact.new" } })).toBe(1);

    const client = await makeClient();
    await expect(setContactHandled(client.actor, id, true)).rejects.toMatchObject({ code: "FORBIDDEN" });
    const handled = await setContactHandled(support.actor, id, true);
    expect(handled.handled).toBe(true);
    expect(handled.handledBy).toBe(support.user.id);
  });
});
