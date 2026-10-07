import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { updateSetting } from "@/services/admin";
import { addBalanceEntry } from "@/services/finance";
import { transaction } from "@/lib/db";
import { runPayout } from "@/services/payouts";
import { listInvoices } from "@/services/invoices";
import { adminSetPlan, choosePlan, commissionRateFor, quotePlanChange, renewPlans, simulatePlans } from "@/services/plans";
import { bookAndPay } from "./flow";
import { makeAdmin, makeBase, makeClient, makeLender, makeProduct, resetDb } from "./helpers";

let base: Awaited<ReturnType<typeof makeBase>>;
let admin: Awaited<ReturnType<typeof makeAdmin>>;
beforeEach(async () => {
  await resetDb();
  base = await makeBase();
  admin = await makeAdmin();
});

const lenderRow = (id: string) => db.lender.findUniqueOrThrow({ where: { id } });
const fees = (lenderId: string) => db.balanceEntry.findMany({ where: { lenderId, kind: "SUBSCRIPTION_FEE" }, orderBy: { createdAt: "asc" } });

describe("formules Découverte, Pro et Premium", () => {
  it("taux de commission : celui de la formule, ou le taux spécifique s'il est plus bas", async () => {
    const s = await getSettings();
    expect(commissionRateFor({ plan: "FREE", commissionRateBps: null }, s)).toBe(1000);
    expect(commissionRateFor({ plan: "PRO", commissionRateBps: null }, s)).toBe(500);
    expect(commissionRateFor({ plan: "PREMIUM", commissionRateBps: null }, s)).toBe(300);
    expect(commissionRateFor({ plan: "PRO", commissionRateBps: 700 }, s)).toBe(500);
    expect(commissionRateFor({ plan: "FREE", commissionRateBps: 200 }, s)).toBe(200);
  });

  it("premier passage en Pro : mois offert, commission de 5 % sur les nouvelles réservations", async () => {
    const l = await makeLender(base.city.id);
    const res = await choosePlan(l.actor, "PRO");
    expect(res.feeNow).toBe(0);
    const lender = await lenderRow(l.lender.id);
    expect(lender.plan).toBe("PRO");
    expect(lender.planRenewsAt!.getTime()).toBeGreaterThan(Date.now() + 27 * 86_400_000);
    expect(await fees(l.lender.id)).toHaveLength(0);
    expect(await db.invoice.count({ where: { kind: "SUBSCRIPTION" } })).toBe(0);

    const p = await makeProduct(l.lender.id, base.category.id, base.city.id, { unitPrice: 10_000 });
    const { reservation } = await bookAndPay(await makeClient(), [{ productId: p.id, quantity: 1, start: 5, end: 7 }]);
    expect(reservation.items[0]).toMatchObject({ commissionRateBps: 500, commission: 1_000 });
  });

  it("montée en Premium : immédiate, facturée, déduite du versement ; descente prévue à l'échéance puis renouvellement", async () => {
    const l = await makeLender(base.city.id);
    await choosePlan(l.actor, "PRO"); // mois offert
    await choosePlan(l.actor, "PREMIUM");
    expect((await lenderRow(l.lender.id)).plan).toBe("PREMIUM");
    expect((await fees(l.lender.id)).map((f) => f.amount)).toEqual([-75_000]);
    const inv = await db.invoice.findFirstOrThrow({ where: { kind: "SUBSCRIPTION", lenderId: l.lender.id } });
    expect(inv).toMatchObject({ totalTtc: 75_000, reservationId: null, clientId: null });

    // Versement : les ventes disponibles moins le prix de la formule.
    await transaction((tx) => addBalanceEntry(tx, { lenderId: l.lender.id, kind: "SALE", amount: 200_000, availableAt: new Date(Date.now() - 1000) }));
    const payout = await runPayout(admin.actor, l.lender.id);
    expect(payout?.amount).toBe(125_000);

    // Passage à Pro : prévu, Premium reste actif jusqu'à l'échéance.
    const scheduled = await choosePlan(l.actor, "PRO");
    expect(scheduled.scheduled).toBe("PRO");
    expect(await lenderRow(l.lender.id)).toMatchObject({ plan: "PREMIUM", nextPlan: "PRO" });

    await db.lender.update({ where: { id: l.lender.id }, data: { planRenewsAt: new Date(Date.now() - 1000) } });
    const r = await renewPlans();
    expect(r.renewed).toBe(1);
    expect(await lenderRow(l.lender.id)).toMatchObject({ plan: "PRO", nextPlan: null });
    expect((await fees(l.lender.id)).map((f) => f.amount)).toEqual([-75_000, -25_000]);
    expect(await db.invoice.count({ where: { kind: "SUBSCRIPTION", lenderId: l.lender.id } })).toBe(2);
  });

  it("changement en cours de période : la part non utilisée est déduite", async () => {
    await updateSetting(admin.actor, "plan.first_month_free", false);
    const l = await makeLender(base.city.id);
    await choosePlan(l.actor, "PRO");
    expect((await fees(l.lender.id)).map((f) => f.amount)).toEqual([-25_000]);
    const quote = await quotePlanChange(db, l.lender.id, "PREMIUM", await getSettings());
    expect(quote.credit).toBeGreaterThan(24_900);
    expect(quote.feeNow).toBe(75_000 - quote.credit);
  });

  it("retour en Découverte à l'échéance, et formules réservées à l'administration si le libre choix est coupé", async () => {
    const l = await makeLender(base.city.id);
    await choosePlan(l.actor, "PRO");
    await choosePlan(l.actor, "FREE");
    await db.lender.update({ where: { id: l.lender.id }, data: { planRenewsAt: new Date(Date.now() - 1000) } });
    expect((await renewPlans()).downgraded).toBe(1);
    expect(await lenderRow(l.lender.id)).toMatchObject({ plan: "FREE", planRenewsAt: null });

    await updateSetting(admin.actor, "plan.self_service", false);
    await expect(choosePlan(l.actor, "PREMIUM")).rejects.toMatchObject({ code: "FORBIDDEN" });
    await adminSetPlan(admin.actor, { lenderId: l.lender.id, plan: "PREMIUM", months: 3, amount: 0, note: "Partenaire de lancement" });
    const lender = await lenderRow(l.lender.id);
    expect(lender.plan).toBe("PREMIUM");
    expect(lender.planRenewsAt!.getTime()).toBeGreaterThan(Date.now() + 85 * 86_400_000);
    expect(await fees(l.lender.id)).toHaveLength(0);
  });

  it("simulateur : formule la plus avantageuse selon le volume réel", async () => {
    const l = await makeLender(base.city.id);
    const p = await makeProduct(l.lender.id, base.category.id, base.city.id, { unitPrice: 100_000, stock: 50 });
    await bookAndPay(await makeClient(), [{ productId: p.id, quantity: 3, start: 5, end: 7 }]); // 600 000
    const sim = await simulatePlans(l.lender.id);
    expect(sim.volume).toBe(600_000);
    expect(sim.rows.map((r) => r.cost)).toEqual([60_000, 25_000 + 30_000, 75_000 + 18_000]);
    expect(sim.best).toBe("PRO");
    expect(sim.saving).toBe(5_000);
  });

  it("factures d'abonnement : visibles par le loueur concerné et l'administration, jamais par un client", async () => {
    await updateSetting(admin.actor, "plan.first_month_free", false);
    const l = await makeLender(base.city.id);
    await choosePlan(l.actor, "PRO");
    expect((await listInvoices(l.actor, { kind: "SUBSCRIPTION" })).total).toBe(1);
    expect((await listInvoices(admin.actor, { kind: "SUBSCRIPTION" })).total).toBe(1);
    expect((await listInvoices((await makeClient()).actor)).total).toBe(0);
    const other = await makeLender(base.city.id);
    expect((await listInvoices(other.actor)).total).toBe(0);
  });
});
