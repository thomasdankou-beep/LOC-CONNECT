import { z } from "zod";
import { Prisma, type Hold, type HoldItem } from "@prisma/client";
import { db, transaction, lockClientOrders, type Tx } from "@/lib/db";
import { AppError, notFound } from "@/lib/errors";
import { addMinutes } from "@/lib/dates";
import { fulfillmentFor, lenderFulfillmentInput, validateLenderFulfillment } from "@/lib/fulfillment";
import { slotInput } from "@/lib/slots";
import { getSettings } from "@/lib/settings";
import { audit, type RequestMeta } from "@/lib/audit";
import { assertAvailable, validateRentalPeriod } from "./availability";
import { quoteDeliveryFees, readTermsSnapshot, snapshotTerms, termsVersion, type TermsSnapshot } from "./order-snapshot";

export const holdInput = z.object({
  fulfillmentType: z.enum(["PICKUP", "DELIVERY"]).default("PICKUP"),
  lenderFulfillment: lenderFulfillmentInput.optional(),
  deliveryAddress: z.string().trim().max(300).optional(),
  deliveryCityId: z.string().optional(),
  deliveryZone: z.string().trim().max(120).optional(),
  contactPhone: z.string().trim().max(30).optional(),
  /** Créneau de livraison (ou de retrait) le premier jour, et de récupération (ou de retour) le dernier jour. */
  deliverySlot: slotInput.optional(),
  returnSlot: slotInput.optional(),
  /** Événement ou société du client (ex. « STORY FOAM »), imprimé sur la proforma et les factures. */
  eventName: z.string().trim().max(120).optional(),
  /** « Lu et approuvé » : le client accepte la commande et les conditions générales des loueurs. */
  acceptTerms: z.boolean().optional(),
  termsVersion: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  /** Libère les autres HOLD actifs du client sur les mêmes produits avant d'en créer un nouveau (parcours de paiement). */
  replaceExisting: z.boolean().default(false),
});
export type HoldInput = z.infer<typeof holdInput>;

/** Taux de HOLD non convertis sur les 90 derniers jours (indicateur d'abus potentiel, alimente SCORE_CLIENT). */
export async function holdNonConversionRate(userId: string, client: Tx | typeof db = db): Promise<{ rate: number; total: number }> {
  const since = new Date(Date.now() - 90 * 86_400_000);
  const [converted, expired] = await Promise.all([
    client.hold.count({ where: { userId, status: "CONVERTED", createdAt: { gte: since } } }),
    client.hold.count({ where: { userId, status: "EXPIRED", createdAt: { gte: since } } }),
  ]);
  const total = converted + expired;
  return { rate: total === 0 ? 0 : expired / total, total };
}

/** Passe en EXPIRED les HOLD arrivés à échéance et annule les réservations non payées qui en dépendent. */
export async function expireHolds(now = new Date()): Promise<number> {
  const stale = await db.hold.findMany({ where: { status: "ACTIVE", expiresAt: { lte: now } }, select: { id: true } });
  if (stale.length === 0) return 0;
  const ids = stale.map((s) => s.id);
  await transaction(async (tx) => {
    await tx.hold.updateMany({ where: { id: { in: ids }, status: "ACTIVE" }, data: { status: "EXPIRED" } });
    const reservations = await tx.reservation.findMany({ where: { holdId: { in: ids }, status: { in: ["HOLD", "PENDING_PAYMENT"] } }, include: { items: true } });
    for (const r of reservations) {
      await tx.reservationItem.updateMany({ where: { reservationId: r.id }, data: { status: "CANCELLED", cancelledAt: now } });
      await tx.reservation.update({ where: { id: r.id }, data: { status: "CANCELLED", cancelledAt: now, cancellationReason: "Délai de paiement expiré, stock libéré." } });
      await tx.payment.updateMany({ where: { reservationId: r.id, status: "PENDING" }, data: { status: "CANCELLED", failureReason: "HOLD expiré" } });
      await tx.reservationStatusHistory.create({ data: { reservationId: r.id, fromStatus: r.status, toStatus: "CANCELLED", note: "HOLD expiré" } });
      await tx.delivery.deleteMany({ where: { reservationId: r.id } });
      await tx.cashSettlement.updateMany({ where: { reservationId: r.id, status: "PENDING" }, data: { status: "CANCELLED" } });
    }
  });
  return ids.length;
}

export type Line = { productId: string; quantity: number; startDate: Date; endDate: Date };
const sameContent = (a: Line[], b: Line[]) => {
  if (a.length !== b.length) return false;
  const key = (l: Line) => `${l.productId}|${l.quantity}|${l.startDate.getTime()}|${l.endDate.getTime()}`;
  const sa = a.map(key).sort();
  const sb = b.map(key).sort();
  return sa.every((v, i) => v === sb[i]);
};

/**
 * Crée un HOLD à partir du panier du client : bloque les quantités pendant la durée configurée.
 * Garde-fous : limite de HOLD actifs (par produit et au total), durée réduite pour les clients à fort taux de HOLD non convertis,
 * contrôle de disponibilité transactionnel. Si un HOLD actif identique existe déjà, il est renvoyé (idempotence).
 * Avec `source`, les lignes viennent d'une proforma au lieu du panier.
 */
export async function createHold(userId: string, input: HoldInput, meta: RequestMeta = {}, source?: { lines: Line[]; quoteId: string; terms: TermsSnapshot }) {
  const settings = await getSettings();
  const cart = source ? null : await db.cart.findUnique({ where: { userId }, include: { items: true } });
  const lines: Line[] = source ? source.lines : (cart?.items ?? []).map((i) => ({ productId: i.productId, quantity: i.quantity, startDate: i.startDate, endDate: i.endDate }));
  if (lines.length === 0) throw new AppError("VALIDATION_ERROR", "Votre panier est vide.");
  if (input.fulfillmentType === "DELIVERY" && !input.deliveryAddress) throw new AppError("VALIDATION_ERROR", "Une adresse de livraison est requise.");
  const nonConversion = await holdNonConversionRate(userId);
  const degraded = nonConversion.total >= 5 && nonConversion.rate * 100 >= settings["hold.nonconversion_threshold_pct"];
  const duration = degraded ? settings["hold.degraded_duration_minutes"] : settings["hold.duration_minutes"];

  return transaction(async (tx) => {
    await lockClientOrders(tx, userId);
    const now = new Date();
    if (source) {
      const quote = await tx.quote.findFirst({ where: { id: source.quoteId, clientId: userId }, include: { reservations: { select: { status: true } } } });
      if (!quote) throw notFound("Proforma");
      if (quote.validUntil <= now) throw new AppError("QUOTE_EXPIRED", "Cette proforma a expiré. Demandez-en une nouvelle.");
      quoteDeliveryFees(quote.data);
      if (quote.reservations.some((r) => !["DRAFT", "HOLD", "PENDING_PAYMENT", "CANCELLED"].includes(r.status))) throw new AppError("CONFLICT", "Cette proforma est déjà payée.");
    }
    await tx.hold.updateMany({ where: { userId, status: "ACTIVE", expiresAt: { lte: now } }, data: { status: "EXPIRED" } });
    const productIds = [...new Set(lines.map((l) => l.productId))];
    const products = await tx.product.findMany({ where: { id: { in: productIds } }, include: { lender: true } });
    for (const line of lines) {
      const p = products.find((x) => x.id === line.productId);
      if (!p || p.status !== "PUBLISHED" || p.deletedAt || p.lender.status !== "APPROVED") throw new AppError("VALIDATION_ERROR", "Un produit de votre panier n'est plus disponible à la location.");
      validateRentalPeriod(settings, p, { quantity: line.quantity, start: line.startDate, end: line.endDate }, now);
    }
    if (input.lenderFulfillment) validateLenderFulfillment(products.map((p) => p.lender), input);
    if (!source && products.some((p) => p.lender.deliveryOnQuote && fulfillmentFor(input, p.lender.id).mode === "DELIVERY")) {
      throw new AppError("VALIDATION_ERROR", "Demandez une proforma pour obtenir le tarif de livraison du loueur.");
    }
    const currentTerms = snapshotTerms(products.map((p) => p.lender));
    const acceptedTerms = source?.terms ?? currentTerms;
    if (!readTermsSnapshot(acceptedTerms) || currentTerms.some((t) => !acceptedTerms.some((a) => a.lenderId === t.lenderId))) throw new AppError("VALIDATION_ERROR", "Les conditions des loueurs doivent être actualisées.");
    if (input.acceptTerms && input.termsVersion && input.termsVersion !== termsVersion(currentTerms)) throw new AppError("CONFLICT", "Les conditions des loueurs ont changé. Rechargez la commande pour les lire et les accepter.");
    const details = {
      fulfillmentType: input.fulfillmentType, deliveryAddress: input.deliveryAddress ?? null,
      deliveryCityId: input.deliveryCityId ?? null, deliveryZone: input.deliveryZone ?? null,
      contactPhone: input.contactPhone ?? null, deliverySlot: input.deliverySlot ?? null,
      returnSlot: input.returnSlot ?? null, eventName: input.eventName || null, quoteId: source?.quoteId ?? null,
    };
    const lenderFulfillment = input.lenderFulfillment?.toSorted((a, b) => a.lenderId.localeCompare(b.lenderId));
    const sameFulfillment = (stored: unknown) => {
      const previous = lenderFulfillmentInput.safeParse(stored);
      return JSON.stringify(previous.success ? previous.data : undefined) === JSON.stringify(lenderFulfillment);
    };
    const active = await tx.hold.findMany({ where: { userId, status: "ACTIVE", expiresAt: { gt: now } }, include: { items: true } });
    const identical = active.find((h) => sameContent(h.items, lines) && sameFulfillment(h.lenderFulfillment)
      && Object.entries(details).every(([key, value]) => h[key as keyof typeof details] === value)
      && Boolean(h.termsAcceptedAt) === Boolean(input.acceptTerms)
      && (!input.acceptTerms || (readTermsSnapshot(h.termsSnapshot) != null && termsVersion(readTermsSnapshot(h.termsSnapshot)!) === termsVersion(acceptedTerms))));
    if (identical) return identical;

    let remaining = active;
    if (input.replaceExisting) {
      const toRelease = active.filter((h) => h.items.some((i) => productIds.includes(i.productId)));
      for (const old of toRelease) {
        const reservations = await tx.reservation.findMany({ where: { holdId: old.id }, include: { payments: { where: { status: "PENDING" }, select: { id: true } } } });
        if (reservations.some((r) => r.status === "PENDING_PAYMENT" || r.payments.length > 0)) throw new AppError("CONFLICT", "Un paiement est en cours pour ces articles. Terminez-le avant de modifier la commande.");
        for (const r of reservations.filter((r) => r.status === "HOLD" || r.status === "DRAFT")) {
          await tx.reservationItem.updateMany({ where: { reservationId: r.id }, data: { status: "CANCELLED", cancelledAt: now } });
          await tx.reservation.update({ where: { id: r.id }, data: { status: "CANCELLED", cancelledAt: now, cancellationReason: "Commande remplacée avant paiement" } });
          await tx.delivery.deleteMany({ where: { reservationId: r.id } });
          await tx.cashSettlement.updateMany({ where: { reservationId: r.id, status: "PENDING" }, data: { status: "CANCELLED" } });
          await tx.reservationStatusHistory.create({ data: { reservationId: r.id, fromStatus: r.status, toStatus: "CANCELLED", actorId: userId, note: "Commande remplacée avant paiement" } });
        }
        await tx.hold.update({ where: { id: old.id }, data: { status: "RELEASED", releasedAt: now } });
      }
      const ids = new Set(toRelease.map((h) => h.id));
      remaining = active.filter((h) => !ids.has(h.id));
    }
    if (remaining.length >= settings["hold.max_total"]) throw new AppError("HOLD_LIMIT_REACHED", "Vous avez atteint la limite de blocages de stock actifs.");
    for (const productId of productIds) {
      if (remaining.filter((h) => h.items.some((i) => i.productId === productId)).length >= settings["hold.max_per_product"]) throw new AppError("HOLD_LIMIT_REACHED", "Vous avez déjà un blocage de stock actif pour l'un de ces produits.");
    }
    await assertAvailable(tx, lines.map((l) => ({ productId: l.productId, quantity: l.quantity, start: l.startDate, end: l.endDate })));
    const hold = await tx.hold.create({
      data: { userId, expiresAt: addMinutes(now, duration), durationMinutes: duration, ...details,
        lenderFulfillment: lenderFulfillment ?? Prisma.DbNull,
        termsAcceptedAt: input.acceptTerms ? now : null,
        termsSnapshot: input.acceptTerms ? acceptedTerms as Prisma.InputJsonValue : Prisma.DbNull,
        items: { create: lines.map((l) => ({ productId: l.productId, quantity: l.quantity, startDate: l.startDate, endDate: l.endDate })) },
      }, include: { items: true },
    });
    if (source) await tx.quote.update({ where: { id: source.quoteId }, data: { acceptedAt: hold.termsAcceptedAt } });
    await audit(tx, { userId, action: "hold.create", entity: "Hold", entityId: hold.id, newValue: { durationMinutes: duration, degraded, products: productIds }, meta });
    return hold;
  });
}

export async function releaseHold(userId: string, holdId: string, meta: RequestMeta = {}): Promise<void> {
  const hold = await db.hold.findFirst({ where: { id: holdId, userId } });
  if (!hold) throw notFound("Blocage de stock");
  if (hold.status !== "ACTIVE") return;
  const reservation = await db.reservation.findFirst({ where: { holdId, status: "PENDING_PAYMENT" } });
  if (reservation) throw new AppError("CONFLICT", "Un paiement est en cours pour ce blocage de stock.");
  await transaction(async (tx) => {
    await tx.hold.update({ where: { id: holdId }, data: { status: "RELEASED", releasedAt: new Date() } });
    const draft = await tx.reservation.findFirst({ where: { holdId, status: "HOLD" }, include: { items: true } });
    if (draft) {
      await tx.reservationItem.updateMany({ where: { reservationId: draft.id }, data: { status: "CANCELLED", cancelledAt: new Date() } });
      await tx.reservation.update({ where: { id: draft.id }, data: { status: "CANCELLED", cancelledAt: new Date(), cancellationReason: "Blocage de stock libéré par le client." } });
      await tx.delivery.deleteMany({ where: { reservationId: draft.id } });
      await tx.cashSettlement.updateMany({ where: { reservationId: draft.id, status: "PENDING" }, data: { status: "CANCELLED" } });
    }
    await audit(tx, { userId, action: "hold.release", entity: "Hold", entityId: holdId, meta });
  });
}

export type HoldView = Hold & { items: (HoldItem & { productName: string })[]; secondsLeft: number };

export async function getHold(userId: string, holdId: string): Promise<HoldView> {
  const hold = await db.hold.findFirst({ where: { id: holdId, userId }, include: { items: { include: { product: { select: { name: true } } } } } });
  if (!hold) throw notFound("Blocage de stock");
  const secondsLeft = hold.status === "ACTIVE" ? Math.max(0, Math.floor((hold.expiresAt.getTime() - Date.now()) / 1000)) : 0;
  return { ...hold, items: hold.items.map((i) => ({ ...i, productName: i.product.name })), secondsLeft };
}

/** Expiration manuelle (POST /reservation-holds/:id/expire) : utile pour tester et pour l'abandon explicite du paiement. */
export async function expireHold(userId: string, holdId: string): Promise<void> {
  const hold = await db.hold.findFirst({ where: { id: holdId, userId } });
  if (!hold) throw notFound("Blocage de stock");
  if (hold.status !== "ACTIVE") return;
  await db.hold.update({ where: { id: holdId }, data: { expiresAt: new Date(Date.now() - 1000) } });
  await expireHolds();
}

export async function activeHoldForUser(userId: string) {
  return db.hold.findFirst({ where: { userId, status: "ACTIVE", expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" }, include: { items: true } });
}
