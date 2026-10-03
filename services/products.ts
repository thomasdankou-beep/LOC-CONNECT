import { z } from "zod";
import type { Prisma, ProductStatus } from "@prisma/client";
import { db, lockProducts, transaction } from "@/lib/db";
import { AppError, forbidden, notFound } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { parseDate, todayUTC } from "@/lib/dates";
import { shortCode, slugify } from "@/lib/ids";
import { getSettings } from "@/lib/settings";
import { can, type Actor } from "@/lib/auth/actor";
import { notifyAdmins, notifyLender } from "./notifications";

export const productInput = z.object({
  name: z.string().trim().min(3).max(120),
  description: z.string().trim().min(20, "Décrivez le produit en au moins 20 caractères").max(4000),
  conditions: z.string().trim().max(2000).optional(),
  categoryId: z.string().min(1),
  cityId: z.string().min(1),
  unitPrice: z.number().int().positive().max(100_000_000),
  stockQuantity: z.number().int().min(0).max(100_000),
  depositAmount: z.number().int().min(0).max(1_000_000_000),
  refundPrice: z.number().int().min(0).max(1_000_000_000),
  minDays: z.number().int().min(1).max(365).default(1),
  maxDays: z.number().int().min(1).max(365).nullable().optional(),
  allowsExtraBilling: z.boolean().optional(),
  photoUrls: z.array(z.string().max(500)).max(10).optional(),
  publish: z.boolean().default(false),
});
export type ProductInput = z.infer<typeof productInput>;

type LenderActor = Actor & { lenderId: string };

async function uniqueSlug(name: string): Promise<string> {
  const base = slugify(name) || "produit";
  let slug = base;
  while (await db.product.findUnique({ where: { slug } })) slug = `${base}-${shortCode(4).toLowerCase()}`;
  return slug;
}

async function statusForPublish(actor: LenderActor, publish: boolean): Promise<ProductStatus> {
  if (!publish) return "DRAFT";
  const settings = await getSettings();
  if (actor.lenderStatus !== "APPROVED") return "DRAFT";
  return settings["moderation.products_require_review"] ? "PENDING_REVIEW" : "PUBLISHED";
}

export async function createProduct(actor: LenderActor, input: ProductInput) {
  if (!can(actor, "PRODUCT_CREATE")) throw forbidden("Votre rôle ne permet pas de créer des produits.");
  const settings = await getSettings();
  const status = await statusForPublish(actor, input.publish);
  const [category, city] = await Promise.all([db.category.findUnique({ where: { id: input.categoryId } }), db.city.findUnique({ where: { id: input.cityId } })]);
  if (!category || !city) throw new AppError("VALIDATION_ERROR", "Catégorie ou ville inconnue.");
  if (input.maxDays != null && input.maxDays < input.minDays) throw new AppError("VALIDATION_ERROR", "La durée maximale doit être supérieure à la durée minimale.");
  const slug = await uniqueSlug(input.name);
  return transaction(async (tx) => {
    const product = await tx.product.create({
      data: {
        slug,
        name: input.name,
        description: input.description,
        conditions: input.conditions,
        unitPrice: input.unitPrice,
        stockQuantity: input.stockQuantity,
        depositAmount: input.depositAmount,
        refundPrice: input.refundPrice,
        minDays: input.minDays,
        maxDays: input.maxDays ?? null,
        allowsExtraBilling: input.allowsExtraBilling ?? settings["deposit.extra_billing_default"],
        status,
        lenderId: actor.lenderId,
        categoryId: input.categoryId,
        cityId: input.cityId,
        photos: { create: (input.photoUrls ?? []).map((url, position) => ({ url, position, alt: input.name })) },
      },
    });
    await tx.stockMovement.create({ data: { productId: product.id, delta: input.stockQuantity, previousQty: 0, newQty: input.stockQuantity, reason: "INITIAL", createdById: actor.userId } });
    await audit(tx, { userId: actor.userId, lenderId: actor.lenderId, action: "product.create", entity: "Product", entityId: product.id, newValue: { name: input.name, price: input.unitPrice, stock: input.stockQuantity, status }, meta: actor.meta });
    if (status === "PENDING_REVIEW") await notifyAdmins(tx, { type: "product.pending", title: "Produit à modérer", body: input.name, link: "/admin/produits" }, "ADMIN_PRODUCTS");
    return product;
  });
}

async function ownProduct(actor: LenderActor, id: string) {
  const product = await db.product.findFirst({ where: { id, lenderId: actor.lenderId, deletedAt: null } });
  if (!product) throw notFound("Produit");
  return product;
}

export const productPatch = productInput.partial().omit({ publish: true, stockQuantity: true }).extend({ photoUrls: z.array(z.string().max(500)).max(10).optional() });

/** Modification d'un produit. Le prix modifié est historisé ; une réservation existante n'est jamais affectée (montants figés). */
export async function updateProduct(actor: LenderActor, id: string, patch: z.infer<typeof productPatch>) {
  if (!can(actor, "PRODUCT_UPDATE")) throw forbidden("Votre rôle ne permet pas de modifier des produits.");
  const product = await ownProduct(actor, id);
  const { photoUrls, ...data } = patch;
  return transaction(async (tx) => {
    if (data.unitPrice != null && data.unitPrice !== product.unitPrice) {
      await tx.productPriceHistory.create({ data: { productId: id, oldPrice: product.unitPrice, newPrice: data.unitPrice, changedById: actor.userId } });
    }
    const updated = await tx.product.update({ where: { id }, data: { ...data, ...(product.status === "REJECTED" ? { status: "DRAFT", rejectionReason: null } : {}) } });
    if (photoUrls) {
      await tx.productPhoto.deleteMany({ where: { productId: id } });
      await tx.productPhoto.createMany({ data: photoUrls.map((url, position) => ({ productId: id, url, position, alt: updated.name })) });
    }
    await audit(tx, { userId: actor.userId, lenderId: actor.lenderId, action: "product.update", entity: "Product", entityId: id, oldValue: { price: product.unitPrice, deposit: product.depositAmount, name: product.name }, newValue: data, meta: actor.meta });
    return updated;
  });
}

export async function setProductStatus(actor: LenderActor, id: string, action: "publish" | "deactivate" | "reactivate") {
  if (!can(actor, action === "deactivate" ? "PRODUCT_DELETE" : "PRODUCT_UPDATE")) throw forbidden();
  const product = await ownProduct(actor, id);
  const settings = await getSettings();
  let next: ProductStatus;
  if (action === "deactivate") next = "INACTIVE";
  else {
    if (actor.lenderStatus !== "APPROVED") throw new AppError("FORBIDDEN", "Votre entreprise doit être validée pour publier des produits.");
    if (action === "publish" && !["DRAFT", "REJECTED"].includes(product.status)) throw new AppError("CONFLICT", "Ce produit ne peut pas être soumis dans son état actuel.");
    next = settings["moderation.products_require_review"] && product.status !== "INACTIVE" ? "PENDING_REVIEW" : "PUBLISHED";
  }
  return transaction(async (tx) => {
    const updated = await tx.product.update({ where: { id }, data: { status: next, rejectionReason: null } });
    await audit(tx, { userId: actor.userId, lenderId: actor.lenderId, action: `product.${action}`, entity: "Product", entityId: id, oldValue: { status: product.status }, newValue: { status: next }, meta: actor.meta });
    if (next === "PENDING_REVIEW") await notifyAdmins(tx, { type: "product.pending", title: "Produit à modérer", body: product.name, link: "/admin/produits" }, "ADMIN_PRODUCTS");
    return updated;
  });
}

/** Suppression logique : l'historique financier et les réservations passées restent intacts. Refusée s'il reste des locations à venir. */
export async function deleteProduct(actor: LenderActor, id: string) {
  if (!can(actor, "PRODUCT_DELETE")) throw forbidden();
  const product = await ownProduct(actor, id);
  const active = await db.reservationItem.count({ where: { productId: id, status: { in: ["PAID", "CONFIRMED", "READY", "DELIVERING", "DELIVERED", "IN_USE", "RETURN_PENDING", "RETURNED", "DISPUTED"] } } });
  if (active > 0) throw new AppError("CONFLICT", "Des réservations sont en cours sur ce produit : désactivez-le plutôt que de le supprimer.");
  await transaction(async (tx) => {
    await tx.product.update({ where: { id }, data: { deletedAt: new Date(), status: "INACTIVE" } });
    await audit(tx, { userId: actor.userId, lenderId: actor.lenderId, action: "product.delete", entity: "Product", entityId: id, oldValue: { name: product.name }, meta: actor.meta });
  });
}

export const stockAdjust = z.object({ delta: z.number().int().refine((n) => n !== 0, "Variation nulle"), reason: z.enum(["PURCHASE", "REPAIR", "LOSS", "CORRECTION", "RETURN_TO_STOCK"]), note: z.string().trim().max(300).optional() });

/** Ajustement de stock avec verrouillage du produit, journal des mouvements et refus d'un stock inférieur au stock engagé. */
export async function adjustStock(actor: LenderActor, id: string, input: z.infer<typeof stockAdjust>) {
  if (!can(actor, "STOCK_ADJUST")) throw forbidden("Votre rôle ne permet pas d'ajuster le stock.");
  await ownProduct(actor, id);
  return transaction(async (tx) => {
    await lockProducts(tx, [id]);
    const product = await tx.product.findUniqueOrThrow({ where: { id } });
    const next = product.stockQuantity + input.delta;
    if (next < 0) throw new AppError("VALIDATION_ERROR", "Le stock ne peut pas être négatif.");
    const today = todayUTC();
    const committed = await tx.reservationItem.findMany({ where: { productId: id, status: { in: ["PAID", "CONFIRMED", "READY", "DELIVERING", "DELIVERED", "IN_USE", "RETURN_PENDING", "DISPUTED"] }, endDate: { gt: today } }, select: { quantity: true, startDate: true, endDate: true } });
    const peak = committed.reduce((max, c) => Math.max(max, committed.filter((o) => o.startDate < c.endDate && o.endDate > c.startDate).reduce((a, o) => a + o.quantity, 0)), 0);
    if (input.delta < 0 && next < peak) throw new AppError("STOCK_INSUFFICIENT", `Impossible de descendre sous le stock déjà réservé (${peak}).`, { committed: peak });
    const updated = await tx.product.update({ where: { id }, data: { stockQuantity: next } });
    await tx.stockMovement.create({ data: { productId: id, delta: input.delta, previousQty: product.stockQuantity, newQty: next, reason: input.reason, note: input.note, createdById: actor.userId } });
    await audit(tx, { userId: actor.userId, lenderId: actor.lenderId, action: "stock.adjust", entity: "Product", entityId: id, oldValue: { stock: product.stockQuantity }, newValue: { stock: next, reason: input.reason }, meta: actor.meta });
    return updated;
  });
}

export const blockInput = z.object({ startDate: z.string(), endDate: z.string(), quantity: z.number().int().positive(), reason: z.string().trim().max(200).optional() });

/** Blocage de disponibilité d'un produit (maintenance, usage interne) sur une période. */
export async function createBlock(actor: LenderActor, productId: string, input: z.infer<typeof blockInput>) {
  if (!can(actor, "CALENDAR_MANAGE")) throw forbidden();
  await ownProduct(actor, productId);
  const start = parseDate(input.startDate);
  const end = parseDate(input.endDate);
  if (!(start < end)) throw new AppError("VALIDATION_ERROR", "La date de début doit précéder la date de fin.");
  return transaction(async (tx) => {
    await lockProducts(tx, [productId]);
    const block = await tx.availabilityBlock.create({ data: { productId, startDate: start, endDate: end, quantity: input.quantity, reason: input.reason, createdById: actor.userId } });
    await audit(tx, { userId: actor.userId, lenderId: actor.lenderId, action: "availability.block", entity: "Product", entityId: productId, newValue: input, meta: actor.meta });
    return block;
  });
}

export async function deleteBlock(actor: LenderActor, blockId: string) {
  if (!can(actor, "CALENDAR_MANAGE")) throw forbidden();
  const block = await db.availabilityBlock.findFirst({ where: { id: blockId, product: { lenderId: actor.lenderId } } });
  if (!block) throw notFound("Blocage");
  await db.availabilityBlock.delete({ where: { id: blockId } });
}

export async function listLenderProducts(lenderId: string, opts: { q?: string; status?: ProductStatus; page?: number; pageSize?: number } = {}) {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = opts.pageSize ?? 15;
  const where: Prisma.ProductWhereInput = { lenderId, deletedAt: null, ...(opts.status ? { status: opts.status } : {}), ...(opts.q ? { name: { contains: opts.q, mode: "insensitive" } } : {}) };
  const [total, rows] = await Promise.all([
    db.product.count({ where }),
    db.product.findMany({ where, include: { photos: { orderBy: { position: "asc" }, take: 1 }, category: { select: { name: true } }, city: { select: { name: true } } }, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
  ]);
  return { rows, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function getLenderProduct(lenderId: string, id: string) {
  const product = await db.product.findFirst({ where: { id, lenderId, deletedAt: null }, include: { photos: { orderBy: { position: "asc" } }, category: true, city: true, blocks: { where: { endDate: { gte: todayUTC() } }, orderBy: { startDate: "asc" } }, stockMoves: { orderBy: { createdAt: "desc" }, take: 20 }, priceHistory: { orderBy: { createdAt: "desc" }, take: 10 } } });
  if (!product) throw notFound("Produit");
  return product;
}

/** Stock engagé et disponible aujourd'hui par produit (vue stock du loueur). */
export async function stockOverview(lenderId: string) {
  const today = todayUTC();
  const products = await db.product.findMany({ where: { lenderId, deletedAt: null }, select: { id: true, name: true, slug: true, stockQuantity: true, status: true } });
  const [items, holds, blocks] = await Promise.all([
    db.reservationItem.findMany({ where: { lenderId, status: { in: ["PAID", "CONFIRMED", "READY", "DELIVERING", "DELIVERED", "IN_USE", "RETURN_PENDING", "DISPUTED"] }, startDate: { lte: today }, endDate: { gt: today } }, select: { productId: true, quantity: true } }),
    db.holdItem.findMany({ where: { product: { lenderId }, startDate: { lte: today }, endDate: { gt: today }, hold: { status: "ACTIVE", expiresAt: { gt: new Date() } } }, select: { productId: true, quantity: true } }),
    db.availabilityBlock.findMany({ where: { product: { lenderId }, startDate: { lte: today }, endDate: { gt: today } }, select: { productId: true, quantity: true } }),
  ]);
  const by = (rows: { productId: string; quantity: number }[], id: string) => rows.filter((r) => r.productId === id).reduce((a, r) => a + r.quantity, 0);
  return products.map((p) => {
    const reserved = by(items, p.id);
    const held = by(holds, p.id);
    const blocked = by(blocks, p.id);
    return { ...p, reserved, held, blocked, available: Math.max(0, p.stockQuantity - reserved - held - blocked) };
  });
}

// ---------------------------------------------------------------------------
// Modération (administration)
// ---------------------------------------------------------------------------

export async function moderateProduct(actor: Actor, id: string, decision: "approve" | "reject" | "suspend", reason?: string) {
  if (actor.accountType !== "ADMIN" || !can(actor, "ADMIN_PRODUCTS")) throw forbidden();
  const product = await db.product.findUnique({ where: { id } });
  if (!product) throw notFound("Produit");
  if (decision === "reject" && !reason) throw new AppError("VALIDATION_ERROR", "Un motif est obligatoire pour refuser un produit.");
  const status: ProductStatus = decision === "approve" ? "PUBLISHED" : decision === "reject" ? "REJECTED" : "INACTIVE";
  return transaction(async (tx) => {
    const updated = await tx.product.update({ where: { id }, data: { status, rejectionReason: decision === "approve" ? null : reason } });
    await audit(tx, { userId: actor.userId, lenderId: product.lenderId, action: `product.${decision}`, entity: "Product", entityId: id, oldValue: { status: product.status }, newValue: { status, reason }, meta: actor.meta });
    await notifyLender(tx, product.lenderId, { type: `product.${decision}`, title: decision === "approve" ? `Produit publié : ${product.name}` : `Produit ${decision === "reject" ? "refusé" : "suspendu"} : ${product.name}`, body: reason ?? "Votre produit est désormais visible dans le catalogue.", link: "/loueur/produits" }, "PRODUCT_VIEW");
    return updated;
  });
}
