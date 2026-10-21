import type { z } from "zod";
import type { LenderPaymentMode, Prisma, Quote, ReservationStatus } from "@prisma/client";
import { db, transaction } from "@/lib/db";
import { AppError, forbidden, notFound } from "@/lib/errors";
import { audit, type RequestMeta } from "@/lib/audit";
import { addDays, formatDate } from "@/lib/dates";
import { formatFcfa, sum } from "@/lib/money";
import { getSettings } from "@/lib/settings";
import { can, type Actor } from "@/lib/auth/actor";
import type { Slot } from "@/lib/slots";
import { validateRentalPeriod } from "./availability";
import { getCart } from "./cart";
import { createHold, holdInput } from "./holds";
import { nextNumber, scheduleOf, type InvoiceLine, type InvoiceParty, type InvoiceSchedule } from "./invoices";
import { priceOrder } from "./reservations";

/**
 * Proforma : devis chiffré du panier, envoyé au client avant le paiement. Ce n'est pas une facture.
 * Les montants sont calculés par `priceOrder`, comme pour la réservation : payer la proforma donne exactement ces montants,
 * sinon le paiement est refusé (PRICE_CHANGED). La disponibilité du matériel n'est garantie qu'au paiement.
 */

export const quoteInput = holdInput.omit({ replaceExisting: true });

export type QuoteGroup = {
  seller: InvoiceParty;
  lines: InvoiceLine[];
  rental: number;
  delivery: number;
  deposit: number;
  paymentMode: LenderPaymentMode;
  /** Part réglée en espèces au loueur à la remise (location et livraison). */
  cash: number;
};

export type QuoteData = {
  platform: InvoiceParty;
  buyer: InvoiceParty;
  fulfillment: "PICKUP" | "DELIVERY";
  schedule: InvoiceSchedule;
  groups: QuoteGroup[];
  totals: {
    rental: number;
    delivery: number;
    /** Location et livraison. */
    totalRental: number;
    deposit: number;
    /** Location, livraison et caution. */
    netToPay: number;
    /** Payé en ligne à la commande. */
    online: number;
    /** À régler en espèces aux loueurs à la remise. */
    cash: number;
  };
  notes: string[];
};

export type QuoteStatus = "OPEN" | "PAID" | "EXPIRED";

const UNPAID: ReservationStatus[] = ["DRAFT", "HOLD", "PENDING_PAYMENT", "CANCELLED"];

/** Payée dès qu'une réservation issue de la proforma a été réglée ; sinon expirée après sa date de validité. */
export function quoteStatus(quote: Pick<Quote, "validUntil">, reservations: { status: ReservationStatus }[], now = new Date()): QuoteStatus {
  if (reservations.some((r) => !UNPAID.includes(r.status))) return "PAID";
  return quote.validUntil <= now ? "EXPIRED" : "OPEN";
}

export const QUOTE_STATUS: Record<QuoteStatus, { label: string; tone: "success" | "warning" | "neutral" }> = {
  OPEN: { label: "À payer", tone: "warning" },
  PAID: { label: "Payée", tone: "success" },
  EXPIRED: { label: "Expirée", tone: "neutral" },
};

/** Proforma du panier du client : lignes, livraison, créneaux et totaux figés pendant la durée de validité. */
export async function createQuote(userId: string, input: z.infer<typeof quoteInput>, meta: RequestMeta = {}) {
  const settings = await getSettings();
  const cart = await getCart(userId);
  if (cart.lines.length === 0) throw new AppError("VALIDATION_ERROR", "Votre panier est vide.");
  if (cart.issues > 0) throw new AppError("STOCK_INSUFFICIENT", "Un article de votre panier n'est plus disponible : corrigez le panier avant de demander une proforma.");
  if (input.fulfillmentType === "DELIVERY" && !input.deliveryAddress) throw new AppError("VALIDATION_ERROR", "Une adresse de livraison est requise.");

  const items = await db.cartItem.findMany({ where: { cart: { userId } }, include: { product: { include: { lender: { include: { city: true } } } } }, orderBy: { createdAt: "asc" } });
  const now = new Date();
  for (const i of items) validateRentalPeriod(settings, i.product, { quantity: i.quantity, start: i.startDate, end: i.endDate }, now);
  const { priced, totals } = priceOrder(settings, items, input.fulfillmentType, input.deliveryCityId);

  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  const city = input.deliveryCityId ? await db.city.findUnique({ where: { id: input.deliveryCityId } }) : null;
  const address = input.fulfillmentType === "DELIVERY" ? [input.deliveryAddress, input.deliveryZone, city?.name].filter(Boolean).join(", ") : null;

  const groups: QuoteGroup[] = totals.byLender.map((b) => {
    const mine = items.filter((i) => i.product.lenderId === b.lenderId);
    const lender = mine[0].product.lender;
    const lines: InvoiceLine[] = mine.map((i) => {
      const p = priced[items.indexOf(i)];
      return { label: i.product.name, detail: `du ${formatDate(i.startDate)} au ${formatDate(i.endDate)}`, quantity: p.quantity, days: p.days, unitPrice: p.unitPrice, refundPrice: p.refundPrice, amount: p.subtotal };
    });
    if (b.delivery > 0) lines.push({ label: "Transport (livraison et récupération)", detail: address ?? undefined, quantity: 1, unitPrice: b.delivery, amount: b.delivery });
    return {
      seller: { name: lender.companyName, address: [lender.address, lender.city.name].filter(Boolean).join(", "), phone: lender.phone, email: lender.email, rccm: lender.rccm, ncc: lender.taxNumber },
      lines,
      rental: b.rental,
      delivery: b.delivery,
      deposit: b.deposit,
      paymentMode: b.paymentMode,
      cash: b.cash,
    };
  });

  const validUntil = addDays(now, settings["quote.validity_days"]);
  const netToPay = totals.subtotal + totals.deliveryFee + totals.depositTotal;
  const notes = [
    `Proforma valable jusqu'au ${formatDate(validUntil)}, sous réserve de disponibilité du matériel au moment du paiement.`,
    "La caution est remboursable après la restitution du matériel en bon état ; les pertes sont déduites au prix de remboursement indiqué.",
    ...(totals.cashTotal > 0 ? [`Acompte de ${formatFcfa(totals.total)} payé en ligne à la commande (caution comprise). Solde de ${formatFcfa(totals.cashTotal)} à régler en espèces au loueur à la remise du matériel.`] : []),
    "Ce document n'est pas une facture. Les factures sont émises par chaque loueur à la confirmation du paiement.",
  ];
  const data: QuoteData = {
    platform: { name: settings["invoice.company_name"], address: settings["invoice.company_address"], rccm: settings["invoice.company_rccm"], ncc: settings["invoice.company_ncc"], phone: settings["site.support_phone"], email: settings["site.support_email"] },
    buyer: { name: `${user.firstName} ${user.lastName}`, phone: input.contactPhone || user.phone, email: user.email, address },
    fulfillment: input.fulfillmentType,
    schedule: scheduleOf(items, input.deliverySlot ?? null, input.returnSlot ?? null),
    groups,
    totals: { rental: totals.subtotal, delivery: totals.deliveryFee, totalRental: totals.subtotal + totals.deliveryFee, deposit: totals.depositTotal, netToPay, online: totals.total, cash: totals.cashTotal },
    notes,
  };

  return transaction(async (tx) => {
    const quote = await tx.quote.create({
      data: {
        number: await nextNumber(tx, "PF", now),
        clientId: userId,
        validUntil,
        fulfillmentType: input.fulfillmentType,
        deliveryAddress: input.deliveryAddress ?? null,
        deliveryCityId: input.deliveryCityId ?? null,
        deliveryZone: input.deliveryZone ?? null,
        contactPhone: input.contactPhone ?? null,
        deliverySlot: input.deliverySlot ?? null,
        returnSlot: input.returnSlot ?? null,
        total: totals.total,
        netToPay,
        data: data as unknown as Prisma.InputJsonValue,
        items: { create: items.map((i) => ({ productId: i.productId, quantity: i.quantity, startDate: i.startDate, endDate: i.endDate })) },
      },
    });
    await audit(tx, { userId, action: "quote.create", entity: "Quote", entityId: quote.id, newValue: { number: quote.number, total: quote.total, netToPay }, meta });
    return quote;
  });
}

/** Le client voit ses proformas ; l'administration les voit toutes. */
function quoteScope(actor: Actor): Prisma.QuoteWhereInput {
  if (actor.accountType === "CLIENT") return { clientId: actor.userId };
  if (actor.accountType === "ADMIN" && can(actor, "ADMIN_RESERVATIONS")) return {};
  throw forbidden("Les proformas sont réservées au client qui les a demandées.");
}

export async function getQuoteForActor(actor: Actor, id: string) {
  const quote = await db.quote.findFirst({ where: { id, ...quoteScope(actor) }, include: { reservations: { select: { id: true, reference: true, status: true }, orderBy: { createdAt: "desc" } } } });
  if (!quote) throw notFound("Proforma");
  return { quote, data: quote.data as unknown as QuoteData, status: quoteStatus(quote, quote.reservations) };
}

export async function listQuotes(actor: Actor, opts: { take?: number } = {}) {
  const rows = await db.quote.findMany({ where: quoteScope(actor), include: { reservations: { select: { id: true, reference: true, status: true } } }, orderBy: { createdAt: "desc" }, take: opts.take ?? 50 });
  return rows.map((q) => ({ ...q, status: quoteStatus(q, q.reservations) }));
}

/**
 * Paiement d'une proforma : bloque le stock avec ses lignes, sans toucher au panier. Le montant est vérifié ici puis
 * à la création de la réservation ; s'il a changé, le client doit demander une nouvelle proforma.
 */
export async function payQuote(userId: string, quoteId: string, meta: RequestMeta = {}) {
  const quote = await db.quote.findFirst({ where: { id: quoteId, clientId: userId }, include: { items: { include: { product: { include: { lender: true } } } }, reservations: { select: { status: true } } } });
  if (!quote) throw notFound("Proforma");
  const status = quoteStatus(quote, quote.reservations);
  if (status === "PAID") throw new AppError("CONFLICT", `La proforma ${quote.number} est déjà payée.`);
  if (status === "EXPIRED") throw new AppError("QUOTE_EXPIRED", `La proforma ${quote.number} a expiré le ${formatDate(quote.validUntil)}. Demandez-en une nouvelle depuis votre panier.`);

  const settings = await getSettings();
  const { totals } = priceOrder(settings, quote.items, quote.fulfillmentType, quote.deliveryCityId);
  if (totals.total !== quote.total || sum([totals.subtotal, totals.deliveryFee, totals.depositTotal]) !== quote.netToPay) {
    throw new AppError("PRICE_CHANGED", `Les prix ont changé depuis la proforma ${quote.number}. Demandez une nouvelle proforma depuis votre panier.`);
  }
  return createHold(
    userId,
    {
      fulfillmentType: quote.fulfillmentType,
      deliveryAddress: quote.deliveryAddress ?? undefined,
      deliveryCityId: quote.deliveryCityId ?? undefined,
      deliveryZone: quote.deliveryZone ?? undefined,
      contactPhone: quote.contactPhone ?? undefined,
      deliverySlot: (quote.deliverySlot ?? undefined) as Slot | undefined,
      returnSlot: (quote.returnSlot ?? undefined) as Slot | undefined,
      replaceExisting: true,
    },
    meta,
    { lines: quote.items.map((i) => ({ productId: i.productId, quantity: i.quantity, startDate: i.startDate, endDate: i.endDate })), quoteId: quote.id },
  );
}
