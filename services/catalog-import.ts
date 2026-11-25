import { z } from "zod";
import { type Actor, can } from "@/lib/auth/actor";
import { MAX_IMPORT_ROWS, type ImportPreview } from "@/lib/catalog-import";
import { db, transaction, type DbOrTx } from "@/lib/db";
import { AppError, forbidden } from "@/lib/errors";
import { getSettings } from "@/lib/settings";
import { insertProduct, productInput, type ProductInput } from "./products";

export const catalogImportInput = z.object({
  commit: z.boolean(),
  rows: z.array(z.object({
    row: z.number().int().min(2).max(1_048_576),
    cells: z.tuple([
      z.string().max(4000), z.string().max(4000), z.string().max(4000), z.string().max(4000),
      z.string().max(4000), z.string().max(4000), z.string().max(4000), z.string().max(4000),
    ]),
  })).min(1).max(MAX_IMPORT_ROWS),
});

type ImportInput = z.infer<typeof catalogImportInput>;

function parseInteger(raw: string) {
  const value = raw.trim().replace(/[ \u00a0\u202f]/g, "");
  return /^\d+$/.test(value) ? Number(value) : Number.NaN;
}

async function prepare(client: DbOrTx, lenderId: string, rows: ImportInput["rows"]) {
  const references = rows.map(({ cells }) => cells[0].trim().toUpperCase());
  const [categories, cities, existing] = await Promise.all([
    client.category.findMany({ select: { id: true, slug: true } }),
    client.city.findMany({ select: { id: true, slug: true } }),
    client.product.findMany({ where: { lenderId, importReference: { in: references } }, select: { importReference: true } }),
  ]);
  const categoryIds = new Map(categories.map(({ id, slug }) => [slug, id]));
  const cityIds = new Map(cities.map(({ id, slug }) => [slug, id]));
  const existingRefs = new Set(existing.map((p) => p.importReference));
  const seen = new Set<string>();
  const preview: ImportPreview[] = [];
  const ready: { reference: string; input: ProductInput }[] = [];

  rows.forEach(({ row, cells }, index) => {
    const [, name, description, category, city, stock, price, replacement] = cells;
    const reference = references[index];
    const label = { row, reference, name };
    if (!/^[A-Z0-9][A-Z0-9._-]{0,63}$/.test(reference)) {
      preview.push({ ...label, status: "error", message: "Référence requise, 64 caractères maximum (lettres, chiffres, point, tiret ou underscore)." });
      return;
    }
    if (seen.has(reference)) {
      preview.push({ ...label, status: "error", message: "Référence répétée dans le fichier." });
      return;
    }
    seen.add(reference);
    if (existingRefs.has(reference)) {
      preview.push({ ...label, status: "existing", message: "Référence déjà importée. La fiche existante est conservée." });
      return;
    }
    const categoryId = categoryIds.get(category.trim().toLowerCase());
    const cityId = cityIds.get(city.trim().toLowerCase());
    if (!categoryId || !cityId) {
      preview.push({ ...label, status: "error", message: "Code catégorie ou ville inconnu. Utilisez les codes du modèle." });
      return;
    }
    const parsed = productInput.safeParse({
      name, description, categoryId, cityId, stockQuantity: parseInteger(stock),
      unitPrice: parseInteger(price), refundPrice: parseInteger(replacement), depositAmount: 0, publish: false,
    });
    if (!parsed.success) {
      const fields = { name: "nom", description: "description (20 caractères minimum)", stockQuantity: "stock", unitPrice: "prix par jour", refundPrice: "valeur de remplacement" };
      const invalid = parsed.error.issues.map((issue) => fields[issue.path[0] as keyof typeof fields]).filter(Boolean);
      preview.push({ ...label, status: "error", message: `À corriger : ${[...new Set(invalid)].join(", ")}.` });
      return;
    }
    preview.push({ ...label, status: "ready" });
    ready.push({ reference, input: parsed.data });
  });
  return { preview, ready };
}

export async function importCatalog(actor: Actor & { lenderId: string }, input: ImportInput) {
  if (!can(actor, "PRODUCT_CREATE")) throw forbidden();
  if (!input.commit) {
    const { preview } = await prepare(db, actor.lenderId, input.rows);
    return { preview, created: 0 };
  }

  const settings = await getSettings();
  return transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Lender" WHERE id = ${actor.lenderId} FOR UPDATE`;
    const { preview, ready } = await prepare(tx, actor.lenderId, input.rows);
    if (preview.some(({ status }) => status === "error")) {
      throw new AppError("VALIDATION_ERROR", "Corrigez les lignes signalées avant de confirmer l’import.");
    }
    for (const row of ready) {
      await insertProduct(tx, actor, row.input, "DRAFT", settings["deposit.extra_billing_default"], row.reference);
    }
    return { preview, created: ready.length };
  });
}
