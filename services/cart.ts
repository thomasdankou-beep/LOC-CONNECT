import { z } from "zod";
import { db } from "@/lib/db";
import { AppError, notFound } from "@/lib/errors";
import { parseDate, daysBetween } from "@/lib/dates";
import { getSettings } from "@/lib/settings";
import { availabilityForProduct, minAvailable, validateRentalPeriod } from "./availability";
import { effectivePaymentMode, priceLine } from "./pricing";
import type { LenderPaymentMode } from "@prisma/client";

export const cartItemInput = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().positive().max(10_000),
  startDate: z.string(),
  endDate: z.string(),
});
export type CartItemInput = z.infer<typeof cartItemInput>;

const itemInclude = {
  product: { include: { photos: { orderBy: { position: "asc" as const }, take: 1 }, lender: { select: { id: true, slug: true, companyName: true, commissionRateBps: true, status: true, cityId: true, offersDelivery: true, deliveryFeeLocal: true, deliveryFeeRemote: true, paymentMode: true, cashModeAllowed: true } } } },
};

async function ensureCart(userId: string) {
  return db.cart.upsert({ where: { userId }, update: {}, create: { userId } });
}

function parsePeriod(startDate: string, endDate: string) {
  try {
    return { start: parseDate(startDate), end: parseDate(endDate) };
  } catch {
    throw new AppError("VALIDATION_ERROR", "Dates invalides (format AAAA-MM-JJ attendu).");
  }
}

async function checkLine(productId: string, quantity: number, start: Date, end: Date) {
  const settings = await getSettings();
  const product = await db.product.findFirst({ where: { id: productId, status: "PUBLISHED", deletedAt: null, lender: { status: "APPROVED" } }, include: { lender: true } });
  if (!product) throw notFound("Produit");
  validateRentalPeriod(settings, product, { quantity, start, end });
  const days = await availabilityForProduct(db, productId, start, end);
  const free = minAvailable(days);
  if (quantity > free) {
    const blocked = days.some((d) => d.lenderBlocked);
    throw new AppError("STOCK_INSUFFICIENT", blocked ? "Le loueur est indisponible sur cette période." : `Quantité indisponible sur cette période (disponible : ${free}).`, { productId, available: free });
  }
  return product;
}

export async function addToCart(userId: string, input: CartItemInput) {
  const { start, end } = parsePeriod(input.startDate, input.endDate);
  await checkLine(input.productId, input.quantity, start, end);
  const cart = await ensureCart(userId);
  const existing = await db.cartItem.findFirst({ where: { cartId: cart.id, productId: input.productId, startDate: start, endDate: end } });
  if (existing) {
    const quantity = existing.quantity + input.quantity;
    await checkLine(input.productId, quantity, start, end);
    return db.cartItem.update({ where: { id: existing.id }, data: { quantity } });
  }
  return db.cartItem.create({ data: { cartId: cart.id, productId: input.productId, quantity: input.quantity, startDate: start, endDate: end } });
}

export const cartItemPatch = z.object({
  quantity: z.number().int().positive().max(10_000).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export async function updateCartItem(userId: string, itemId: string, patch: z.infer<typeof cartItemPatch>) {
  const item = await db.cartItem.findFirst({ where: { id: itemId, cart: { userId } } });
  if (!item) throw notFound("Article du panier");
  const start = patch.startDate ? parsePeriod(patch.startDate, patch.endDate ?? item.endDate.toISOString().slice(0, 10)).start : item.startDate;
  const end = patch.endDate ? parsePeriod(patch.startDate ?? item.startDate.toISOString().slice(0, 10), patch.endDate).end : item.endDate;
  const quantity = patch.quantity ?? item.quantity;
  await checkLine(item.productId, quantity, start, end);
  return db.cartItem.update({ where: { id: item.id }, data: { quantity, startDate: start, endDate: end } });
}

export async function removeCartItem(userId: string, itemId: string): Promise<void> {
  const res = await db.cartItem.deleteMany({ where: { id: itemId, cart: { userId } } });
  if (res.count === 0) throw notFound("Article du panier");
}

export async function clearCart(userId: string): Promise<void> {
  await db.cartItem.deleteMany({ where: { cart: { userId } } });
}

export type CartLineView = {
  id: string;
  productId: string;
  slug: string;
  name: string;
  photo: string | null;
  lenderId: string;
  lenderName: string;
  quantity: number;
  startDate: string;
  endDate: string;
  days: number;
  unitPrice: number;
  subtotal: number;
  commission: number;
  deposit: number;
  paymentMode: LenderPaymentMode;
  /** Part de la location à régler en espèces au loueur. */
  cashDue: number;
  available: number;
  ok: boolean;
};

export type CartView = {
  lines: CartLineView[];
  groups: { lenderId: string; lenderName: string; lines: CartLineView[]; subtotal: number; deposit: number; paymentMode: LenderPaymentMode; cash: number }[];
  subtotal: number;
  deposit: number;
  /** Total à régler en espèces aux loueurs (hors livraison). */
  cash: number;
  /** Total payé en ligne (hors livraison). */
  total: number;
  itemCount: number;
  issues: number;
};

/** Panier recalculé côté serveur : prix actuels, caution, et disponibilité réelle de chaque ligne. */
export async function getCart(userId: string): Promise<CartView> {
  const settings = await getSettings();
  const cart = await db.cart.findUnique({ where: { userId }, include: { items: { include: itemInclude, orderBy: { createdAt: "asc" } } } });
  const lines: CartLineView[] = [];
  for (const item of cart?.items ?? []) {
    const p = item.product;
    const rate = p.lender.commissionRateBps ?? settings["commission.rate_bps"];
    const paymentMode = effectivePaymentMode(p.lender, settings);
    const priced = priceLine({ productId: p.id, lenderId: p.lenderId, quantity: item.quantity, start: item.startDate, end: item.endDate, unitPrice: p.unitPrice, depositAmount: p.depositAmount, refundPrice: p.refundPrice, commissionRateBps: rate, paymentMode, minCashDeposit: settings["cash.min_deposit"] });
    const days = await availabilityForProduct(db, p.id, item.startDate, item.endDate);
    const free = minAvailable(days);
    const sellable = p.status === "PUBLISHED" && !p.deletedAt && p.lender.status === "APPROVED";
    lines.push({
      id: item.id,
      productId: p.id,
      slug: p.slug,
      name: p.name,
      photo: p.photos[0]?.url ?? null,
      lenderId: p.lenderId,
      lenderName: p.lender.companyName,
      quantity: item.quantity,
      startDate: item.startDate.toISOString().slice(0, 10),
      endDate: item.endDate.toISOString().slice(0, 10),
      days: daysBetween(item.startDate, item.endDate),
      unitPrice: p.unitPrice,
      subtotal: priced.subtotal,
      commission: priced.commission,
      deposit: priced.deposit,
      paymentMode,
      cashDue: priced.cashDue,
      available: free,
      ok: sellable && item.quantity <= free,
    });
  }
  const groupsMap = new Map<string, CartView["groups"][number]>();
  for (const l of lines) {
    const g = groupsMap.get(l.lenderId) ?? { lenderId: l.lenderId, lenderName: l.lenderName, lines: [], subtotal: 0, deposit: 0, paymentMode: l.paymentMode, cash: 0 };
    g.lines.push(l);
    g.subtotal += l.subtotal;
    g.deposit += l.deposit;
    g.cash += l.cashDue;
    groupsMap.set(l.lenderId, g);
  }
  const subtotal = lines.reduce((a, l) => a + l.subtotal, 0);
  const deposit = lines.reduce((a, l) => a + l.deposit, 0);
  const cash = lines.reduce((a, l) => a + l.cashDue, 0);
  return {
    lines,
    groups: [...groupsMap.values()],
    subtotal,
    deposit,
    cash,
    total: subtotal + deposit - cash,
    itemCount: lines.reduce((a, l) => a + l.quantity, 0),
    issues: lines.filter((l) => !l.ok).length,
  };
}

export async function cartCount(userId: string): Promise<number> {
  return db.cartItem.count({ where: { cart: { userId } } });
}
