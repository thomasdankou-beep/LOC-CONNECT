import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { addToCart } from "@/services/cart";
import { createHold } from "@/services/holds";
import { availabilityForProduct, minAvailable } from "@/services/availability";
import { date, day, makeBase, makeClient, makeLender, makeProduct, resetDb } from "./helpers";

beforeEach(resetDb);

describe("réservations concurrentes", () => {
  it("ne permet jamais de dépasser le stock : 12 clients se disputent 3 unités", async () => {
    const base = await makeBase();
    const lender = await makeLender(base.city.id);
    const product = await makeProduct(lender.lender.id, base.category.id, base.city.id, { stock: 3 });
    const clients = await Promise.all(Array.from({ length: 12 }, (_, i) => makeClient(`Client${i}`)));
    for (const c of clients) await addToCart(c.user.id, { productId: product.id, quantity: 1, startDate: day(20), endDate: day(22) });

    const results = await Promise.allSettled(clients.map((c) => createHold(c.user.id, { fulfillmentType: "PICKUP", replaceExisting: false })));
    const ok = results.filter((r) => r.status === "fulfilled").length;
    const rejected = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];

    expect(ok).toBe(3);
    expect(rejected).toHaveLength(9);
    expect(rejected.every((r) => (r.reason as { code?: string }).code === "STOCK_INSUFFICIENT")).toBe(true);
    expect(minAvailable(await availabilityForProduct(db, product.id, date(20), date(22)))).toBe(0);
    const held = await db.holdItem.aggregate({ where: { productId: product.id }, _sum: { quantity: true } });
    expect(held._sum.quantity).toBe(3);
  });

  it("gère des périodes qui se chevauchent partiellement", async () => {
    const base = await makeBase();
    const lender = await makeLender(base.city.id);
    const product = await makeProduct(lender.lender.id, base.category.id, base.city.id, { stock: 5 });
    const c1 = await makeClient("A");
    const c2 = await makeClient("B");
    const c3 = await makeClient("C");
    await addToCart(c1.user.id, { productId: product.id, quantity: 4, startDate: day(10), endDate: day(13) });
    await createHold(c1.user.id, { fulfillmentType: "PICKUP", replaceExisting: false });

    // 2 unités du 12 au 15 : le 12 il ne reste que 1 unité.
    await expect(addToCart(c2.user.id, { productId: product.id, quantity: 2, startDate: day(12), endDate: day(15) })).rejects.toMatchObject({ code: "STOCK_INSUFFICIENT" });
    // Période adjacente (fin = début existant) : aucune collision.
    await addToCart(c3.user.id, { productId: product.id, quantity: 5, startDate: day(13), endDate: day(15) });
    await expect(createHold(c3.user.id, { fulfillmentType: "PICKUP", replaceExisting: false })).resolves.toBeTruthy();
  });

  it("empêche la sur-réservation entre deux lignes du même produit dans un panier", async () => {
    const base = await makeBase();
    const lender = await makeLender(base.city.id);
    const product = await makeProduct(lender.lender.id, base.category.id, base.city.id, { stock: 5 });
    const c = await makeClient();
    await addToCart(c.user.id, { productId: product.id, quantity: 3, startDate: day(10), endDate: day(12) });
    await addToCart(c.user.id, { productId: product.id, quantity: 3, startDate: day(11), endDate: day(13) });
    await expect(createHold(c.user.id, { fulfillmentType: "PICKUP", replaceExisting: false })).rejects.toMatchObject({ code: "STOCK_INSUFFICIENT" });
  });
});
