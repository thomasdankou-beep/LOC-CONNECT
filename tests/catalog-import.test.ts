import { beforeEach, expect, it } from "vitest";
import { db } from "@/lib/db";
import { catalogImportInput, importCatalog } from "@/services/catalog-import";
import { makeBase, makeLender, resetDb } from "./helpers";

beforeEach(resetDb);

it("prévisualise le catalogue, refuse un lot invalide et évite un double import", async () => {
  const { category, city } = await makeBase();
  const { actor, lender } = await makeLender(city.id);
  const rows = [{ row: 2, cells: ["CH-01", "Chaise dorée", "Chaise dorée pour réception privée", category.slug, city.slug, "100", "1 500", "25 000"] }];
  const payload = (commit: boolean) => catalogImportInput.parse({ commit, rows });
  expect(await importCatalog(actor, payload(false))).toMatchObject({ created: 0, preview: [{ status: "ready" }] });
  expect(await db.product.count({ where: { lenderId: lender.id } })).toBe(0);

  const invalid = catalogImportInput.parse({ commit: true, rows: [...rows, { row: 3, cells: ["CH-02", "Chaise blanche", "Chaise blanche de cérémonie", category.slug, city.slug, "", "1 500", "25 000"] }] });
  await expect(importCatalog(actor, invalid)).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  expect(await db.product.count({ where: { lenderId: lender.id } })).toBe(0);

  const results = await Promise.all([importCatalog(actor, payload(true)), importCatalog(actor, payload(true))]);
  expect(results.map(({ created }) => created).sort()).toEqual([0, 1]);
  const product = await db.product.findFirstOrThrow({ where: { lenderId: lender.id, importReference: "CH-01" } });
  expect(product).toMatchObject({ status: "DRAFT", stockQuantity: 100, unitPrice: 1500, refundPrice: 25000 });
  expect(await db.stockMovement.count({ where: { productId: product.id, reason: "INITIAL" } })).toBe(1);
});
