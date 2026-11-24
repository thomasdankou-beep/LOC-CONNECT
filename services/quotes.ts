import { z } from "zod";
import type { LenderPaymentMode, Prisma, Quote, ReservationStatus } from "@prisma/client";
import { db, transaction } from "@/lib/db";
import { AppError, forbidden, notFound } from "@/lib/errors";
import { audit, type RequestMeta } from "@/lib/audit";
import { addDays, formatDate, parseDate, toISODate, eventDeliveryWindow } from "@/lib/dates";
import { formatFcfa } from "@/lib/money";
import { getSettings } from "@/lib/settings";
import { can, type Actor } from "@/lib/auth/actor";
import { slotInput, type Slot } from "@/lib/slots";
import { fulfillmentFor, type LenderFulfillment } from "@/lib/fulfillment";
import { assertAvailable, validateRentalPeriod } from "./availability";
import { getCart } from "./cart";
import { createHold, holdInput } from "./holds";
import { lenderParty, nextNumber, scheduleOf, type InvoiceLine, type InvoiceParty, type InvoiceSchedule } from "./invoices";
import { notifyLender, notifyUsers } from "./notifications";
import { priceOrder } from "./reservations";
import { assertQuotePricing, pricingFingerprint, quoteDelivery, quoteDeliveryFees, quoteDeposits, type QuotedDelivery, type TermsSnapshot } from "./order-snapshot";

/**
 * Proforma : devis chiffré du panier, envoyé au client avant le paiement. Ce n'est pas une facture.
 * Les montants sont calculés par `priceOrder`, comme pour la réservation : payer la proforma donne exactement ces montants,
 * sinon le paiement est refusé (PRICE_CHANGED). La disponibilité du matériel n'est garantie qu'au paiement.
 */

export const quoteInput = holdInput.omit({ replaceExisting: true, acceptTerms: true }).extend({ eventDate: z.iso.date().optional() });

/** Le client coche « Lu et approuvé » pour payer : il accepte la proforma et les conditions générales des loueurs. */
export const payQuoteInput = z.object({ accept: z.literal(true, { message: "Cochez « Lu et approuvé » pour accepter la proforma et les conditions générales." }) });

export type QuoteGroup = {
  lenderId: string;
  seller: InvoiceParty;
  fulfillment?: "PICKUP" | "DELIVERY";
  requestedDates?: { delivery: string; recovery: string };
  schedule?: InvoiceSchedule;
  /** Conditions générales du loueur au moment de la proforma. */
  terms?: string | null;
  lines: InvoiceLine[];
  rental: number;
  delivery: number;
  deposit: number;
  paymentMode: LenderPaymentMode;
  /** Part réglée en espèces au loueur à la remise (location et livraison). */
  cash: number;
};

export type QuoteData = {
  pricingFingerprint?: string;
  depositOverrides?: [string, number][];
  logisticsApprovalIds?: string[];
  deliveryApproval?: QuotedDelivery;
  eventDate?: string;
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

export type QuoteStatus = "OPEN" | "PAID" | "EXPIRED" | "AWAITING_DELIVERY";

const UNPAID: ReservationStatus[] = ["DRAFT", "HOLD", "PENDING_PAYMENT", "CANCELLED"];

/** Payée dès qu'une réservation issue de la proforma a été réglée ; sinon expirée après sa date de validité. */
export function quoteStatus(quote: Pick<Quote, "validUntil"> & Partial<Pick<Quote, "data">>, reservations: { status: ReservationStatus }[], now = new Date()): QuoteStatus {
  if (reservations.some((r) => !UNPAID.includes(r.status))) return "PAID";
  if (quote.validUntil <= now) return "EXPIRED";
  return quoteDelivery(quote.data)?.pendingLenderIds.length ? "AWAITING_DELIVERY" : "OPEN";
}

export const QUOTE_STATUS: Record<QuoteStatus, { label: string; tone: "success" | "warning" | "neutral" }> = {
  AWAITING_DELIVERY: { label: "Validation des loueurs en attente", tone: "warning" },
  OPEN: { label: "À payer", tone: "warning" },
  PAID: { label: "Payée", tone: "success" },
  EXPIRED: { label: "Expirée", tone: "neutral" },
};

function quoteNotes(validUntil: Date, totals: ReturnType<typeof priceOrder>["totals"]): string[] {
  return [
    `Proforma valable jusqu'au ${formatDate(validUntil)}, sous réserve de disponibilité du matériel au moment du paiement.`,
    "La caution est remboursable après la restitution du matériel en bon état ; les pertes sont déduites au prix de remboursement indiqué.",
    ...(totals.cashTotal > 0 ? [`Acompte de ${formatFcfa(totals.total)} payé en ligne à la commande (caution comprise). Solde de ${formatFcfa(totals.cashTotal)} à régler en espèces au loueur à la remise du matériel.`] : []),
    "Ce document n'est pas une facture. Les factures sont émises par chaque loueur à la confirmation du paiement.",
  ];
}

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
  const { priced, totals } = priceOrder(settings, items, input.fulfillmentType, input.deliveryCityId, undefined, input.lenderFulfillment, new Map());

  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  const city = input.deliveryCityId ? await db.city.findUnique({ where: { id: input.deliveryCityId } }) : null;
  const address = input.fulfillmentType === "DELIVERY" ? [input.deliveryAddress, input.deliveryZone, city?.name].filter(Boolean).join(", ") : null;

  const groups: QuoteGroup[] = totals.byLender.map((b) => {
    const mine = items.filter((i) => i.product.lenderId === b.lenderId);
    const lender = mine[0].product.lender;
    const plan = fulfillmentFor(input, lender.id);
    const selection = input.lenderFulfillment?.find((entry) => entry.lenderId === lender.id);
    if (selection?.confirmedPickupDate || selection?.confirmedDepotReturnDate) {
      throw new AppError("VALIDATION_ERROR", "Les dates confirmées sont renseignées par le loueur.");
    }
    let requestedDates: QuoteGroup["requestedDates"];
    if (selection?.preferredDeliveryDate || selection?.preferredReturnDate) {
      const { preferredDeliveryDate, preferredReturnDate } = selection;
      const schedule = scheduleOf(mine, null, null);
      const previousDay = toISODate(addDays(parseDate(schedule.outDate), -1));
      const lastDay = toISODate(addDays(parseDate(schedule.backDate), -1));
      if (!preferredDeliveryDate || !preferredReturnDate
        || ![previousDay, schedule.outDate].includes(preferredDeliveryDate)
        || ![lastDay, schedule.backDate].includes(preferredReturnDate)
        || preferredDeliveryDate < toISODate(now)) {
        throw new AppError("VALIDATION_ERROR", "Choisissez des jours de livraison et de récupération compatibles avec la période de location.");
      }
      requestedDates = { delivery: preferredDeliveryDate, recovery: preferredReturnDate };
    }
    const lines: InvoiceLine[] = mine.map((i) => {
      const p = priced[items.indexOf(i)];
      return { label: i.product.name, detail: `du ${formatDate(i.startDate)} au ${formatDate(i.endDate)}`, quantity: p.quantity, days: p.days, unitPrice: p.unitPrice, refundPrice: p.refundPrice, amount: p.subtotal };
    });
    if (b.delivery > 0) lines.push({ label: "Transport (livraison et récupération)", detail: address ?? undefined, quantity: 1, unitPrice: b.delivery, amount: b.delivery });
    return {
      lenderId: b.lenderId,
      ...(requestedDates ? { requestedDates } : {}),
      seller: lenderParty(lender),
      ...(input.lenderFulfillment ? { fulfillment: plan.mode, schedule: scheduleOf(mine, plan.deliverySlot ?? null, plan.returnSlot ?? null) } : {}),
      terms: lender.terms,
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
  const logisticsApprovalIds = groups.filter((group) => group.requestedDates
    || (group.fulfillment !== "PICKUP" && input.fulfillmentType === "DELIVERY"
      && items.some((item) => item.product.lenderId === group.lenderId && item.product.lender.deliveryOnQuote)))
    .map((group) => group.lenderId);
  const pendingLenderIds = groups.map((group) => group.lenderId);
  const legacyPending = logisticsApprovalIds.filter((id) => !groups.some((g) => g.lenderId === id && g.requestedDates));
  if (legacyPending.length) {
    if (!input.eventDate) throw new AppError("VALIDATION_ERROR", "Indiquez la date de l’événement pour demander un devis de livraison.");
    const window = eventDeliveryWindow(input.eventDate);
    const deliveredItems = items.filter((item) => legacyPending.includes(item.product.lenderId));
    if (deliveredItems.some((item) => toISODate(item.startDate) < window.firstDelivery || toISODate(item.endDate) > window.lastRecovery)) {
      throw new AppError("VALIDATION_ERROR", "Pour les articles livrés sur devis, choisissez des dates entre la veille de l’événement et le lendemain.");
    }
  }
  const data: QuoteData = {
    ...(input.eventDate ? { eventDate: input.eventDate } : {}),
    ...(pendingLenderIds.length ? { deliveryApproval: { pendingLenderIds, approvedFees: [] } } : {}),
    depositOverrides: [],
    logisticsApprovalIds,
    pricingFingerprint: pricingFingerprint(priced, totals, items),
    platform: { name: settings["invoice.company_name"], address: settings["invoice.company_address"], rccm: settings["invoice.company_rccm"], ncc: settings["invoice.company_ncc"], phone: settings["site.support_phone"], email: settings["site.support_email"] },
    buyer: { name: `${user.firstName} ${user.lastName}`, phone: input.contactPhone || user.phone, email: user.email, address, event: input.eventName || null },
    fulfillment: input.fulfillmentType,
    schedule: scheduleOf(items, input.deliverySlot ?? null, input.returnSlot ?? null),
    groups,
    totals: { rental: totals.subtotal, delivery: totals.deliveryFee, totalRental: totals.subtotal + totals.deliveryFee, deposit: totals.depositTotal, netToPay, online: totals.total, cash: totals.cashTotal },
    notes: quoteNotes(validUntil, totals),
  };

  return transaction(async (tx) => {
    const quote = await tx.quote.create({
      data: {
        number: await nextNumber(tx, "PF", now),
        clientId: userId,
        validUntil,
        fulfillmentType: input.fulfillmentType,
        lenderFulfillment: input.lenderFulfillment ?? undefined,
        deliveryAddress: input.deliveryAddress ?? null,
        deliveryCityId: input.deliveryCityId ?? null,
        deliveryZone: input.deliveryZone ?? null,
        contactPhone: input.contactPhone ?? null,
        deliverySlot: input.deliverySlot ?? null,
        returnSlot: input.returnSlot ?? null,
        eventName: input.eventName || null,
        total: totals.total,
        netToPay,
        data: data as unknown as Prisma.InputJsonValue,
        items: { create: items.map((i) => ({ productId: i.productId, quantity: i.quantity, startDate: i.startDate, endDate: i.endDate })) },
      },
    });
    await audit(tx, { userId, action: "quote.create", entity: "Quote", entityId: quote.id, newValue: { number: quote.number, total: quote.total, netToPay }, meta });
    for (const lenderId of pendingLenderIds) {
      await notifyLender(tx, lenderId, {
        type: "quote.delivery_requested",
        title: "Proforma à valider",
        body: `Vérifiez la caution et les modalités de remise pour la demande ${quote.number}.`,
        link: "/loueur/livraisons",
      }, "DELIVERY_UPDATE");
    }
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
export async function payQuote(userId: string, quoteId: string, input: z.infer<typeof payQuoteInput>, meta: RequestMeta = {}) {
  if (input.accept !== true) throw new AppError("VALIDATION_ERROR", "Cochez « Lu et approuvé » pour accepter la proforma et les conditions générales.");
  const quote = await db.quote.findFirst({ where: { id: quoteId, clientId: userId }, include: { items: { include: { product: { include: { lender: true } } } }, reservations: { select: { status: true } } } });
  if (!quote) throw notFound("Proforma");
  const status = quoteStatus(quote, quote.reservations);
  if (status === "PAID") throw new AppError("CONFLICT", `La proforma ${quote.number} est déjà payée.`);
  if (status === "EXPIRED") throw new AppError("QUOTE_EXPIRED", `La proforma ${quote.number} a expiré le ${formatDate(quote.validUntil)}. Demandez-en une nouvelle depuis votre panier.`);

  const settings = await getSettings();
  const { priced, totals } = priceOrder(settings, quote.items, quote.fulfillmentType, quote.deliveryCityId, quoteDeliveryFees(quote.data), quote.lenderFulfillment as LenderFulfillment | null, quoteDeposits(quote.data));
  assertQuotePricing(quote, priced, totals, quote.items);
  const terms: TermsSnapshot = (quote.data as unknown as QuoteData).groups.map((g) => ({ lenderId: g.lenderId, terms: g.terms ?? null }));
  const hold = await createHold(
    userId,
    {
      fulfillmentType: quote.fulfillmentType,
      lenderFulfillment: (quote.lenderFulfillment as LenderFulfillment | null) ?? undefined,
      deliveryAddress: quote.deliveryAddress ?? undefined,
      deliveryCityId: quote.deliveryCityId ?? undefined,
      deliveryZone: quote.deliveryZone ?? undefined,
      contactPhone: quote.contactPhone ?? undefined,
      deliverySlot: (quote.deliverySlot ?? undefined) as Slot | undefined,
      returnSlot: (quote.returnSlot ?? undefined) as Slot | undefined,
      eventName: quote.eventName ?? undefined,
      acceptTerms: true,
      replaceExisting: true,
    },
    meta,
    { lines: quote.items.map((i) => ({ productId: i.productId, quantity: i.quantity, startDate: i.startDate, endDate: i.endDate })), quoteId: quote.id, terms },
  );
  await audit(db, { userId, action: "quote.accept", entity: "Quote", entityId: quote.id, newValue: { holdId: hold.id }, meta });
  return hold;
}

const logisticsInput = z.object({
  amount: z.number().int().min(0).max(1_000_000),
  deliveryDate: z.iso.date(),
  returnDate: z.iso.date(),
  deliverySlot: slotInput,
  returnSlot: slotInput,
});

const depositInput = z.number().int().min(0).max(1_000_000_000).optional();
export const deliveryPriceInput = z.union([
  logisticsInput.extend({ depositAmount: depositInput }),
  z.object({ depositOnly: z.literal(true), depositAmount: depositInput }),
]);

type DeliveryActor = Actor & { lenderId: string };

function pendingDeliveryWhere(lenderId: string): Prisma.QuoteWhereInput {
  return {
    acceptedAt: null,
    validUntil: { gt: new Date() },
    data: { path: ["deliveryApproval", "pendingLenderIds"], array_contains: [lenderId] },
    items: { some: { product: { lenderId } } },
  };
}

export async function listDeliveryPriceRequests(actor: DeliveryActor) {
  if (actor.accountType !== "LENDER" || !can(actor, "DELIVERY_UPDATE")) throw forbidden();
  return db.quote.findMany({
    where: pendingDeliveryWhere(actor.lenderId),
    orderBy: { validUntil: "asc" },
    select: {
      id: true, number: true, validUntil: true, deliveryAddress: true, deliveryZone: true,
      deliverySlot: true, returnSlot: true, fulfillmentType: true, lenderFulfillment: true, data: true,
      items: {
        where: { product: { lenderId: actor.lenderId } },
        select: { quantity: true, startDate: true, endDate: true, product: { select: { name: true } } },
      },
    },
  });
}

export async function confirmDeliveryPrice(actor: DeliveryActor, quoteId: string, input: z.infer<typeof deliveryPriceInput>) {
  if (actor.accountType !== "LENDER" || !can(actor, "DELIVERY_UPDATE")) throw forbidden();
  const settings = await getSettings();

  await transaction(async (tx) => {
    // Several lenders can answer the same request at once.
    await tx.$queryRaw`SELECT id FROM "Quote" WHERE id = ${quoteId} FOR UPDATE`;
    const quote = await tx.quote.findFirst({
      where: { id: quoteId, ...pendingDeliveryWhere(actor.lenderId) },
      include: { items: { include: { product: { include: { lender: true } } } } },
    });
    if (!quote) throw notFound("Proforma à valider");
    const data = quote.data as unknown as QuoteData;
    const approval = data.deliveryApproval!;
    approval.pendingLenderIds = approval.pendingLenderIds.filter((id) => id !== actor.lenderId);
    const depositOverrides = quoteDeposits(data);
    const needsLogistics = data.logisticsApprovalIds?.includes(actor.lenderId) ?? true;
    if (needsLogistics === ("depositOnly" in input) || (input.depositAmount !== undefined && !depositOverrides)) {
      throw new AppError("VALIDATION_ERROR", "Vérifiez les champs requis pour cette proforma.");
    }

    // Verify the original basket before applying the confirmed transport prices.
    const originalFees = new Map(data.groups.map((group) => [group.lenderId, group.delivery]));
    const original = priceOrder(settings, quote.items, quote.fulfillmentType, quote.deliveryCityId, originalFees, quote.lenderFulfillment as LenderFulfillment | null, quoteDeposits(quote.data));
    assertQuotePricing(quote, original.priced, original.totals, quote.items);
    if (input.depositAmount !== undefined) depositOverrides!.set(actor.lenderId, input.depositAmount);
    if (depositOverrides) data.depositOverrides = [...depositOverrides];
    let lenderFulfillment = quote.lenderFulfillment as LenderFulfillment | null;
    if (!("depositOnly" in input)) {
      const { amount, deliveryDate, returnDate, deliverySlot, returnSlot } = input;
      const pickup = fulfillmentFor(quote, actor.lenderId).mode === "PICKUP";
      if (pickup && amount !== 0) throw new AppError("VALIDATION_ERROR", "Aucun frais de livraison ne peut être ajouté à un retrait au dépôt.");
      approval.approvedFees.push([actor.lenderId, amount]);
      lenderFulfillment = data.groups.map((group) => {
        const plan = fulfillmentFor(quote, group.lenderId);
        return {
          lenderId: group.lenderId, mode: plan.mode,
          confirmedPickupDate: pickup && group.lenderId === actor.lenderId ? deliveryDate : plan.confirmedPickupDate,
          confirmedDepotReturnDate: pickup && group.lenderId === actor.lenderId ? returnDate : plan.confirmedDepotReturnDate,
          deliverySlot: group.lenderId === actor.lenderId ? deliverySlot : (plan.deliverySlot ?? undefined) as Slot | undefined,
          returnSlot: group.lenderId === actor.lenderId ? returnSlot : (plan.returnSlot ?? undefined) as Slot | undefined,
        };
      });
      const start = parseDate(deliveryDate);
      const end = parseDate(returnDate);
      const mine = quote.items.filter((item) => item.product.lenderId === actor.lenderId);
      const first = Math.min(...mine.map((item) => item.startDate.getTime()));
      const last = Math.max(...mine.map((item) => item.endDate.getTime()));
      const requestedDates = data.groups.find((group) => group.lenderId === actor.lenderId)?.requestedDates;
      const lastRentalDay = toISODate(addDays(new Date(last), -1));
      if (requestedDates) {
        const firstRentalDay = toISODate(new Date(first));
        if (![toISODate(addDays(new Date(first), -1)), firstRentalDay].includes(deliveryDate)
          || ![lastRentalDay, toISODate(new Date(last))].includes(returnDate)
          || deliveryDate < toISODate(new Date())
          || (deliveryDate === returnDate && deliverySlot.split("-")[1] > returnSlot.split("-")[0])) {
          throw new AppError("VALIDATION_ERROR", "Choisissez des jours compatibles avec la location et une récupération après la livraison.");
        }
      } else if (data.eventDate) {
        const window = eventDeliveryWindow(data.eventDate);
        if (deliveryDate < window.firstDelivery || deliveryDate > window.lastDelivery
          || returnDate < window.firstRecovery || returnDate > window.lastRecovery) {
          throw new AppError("VALIDATION_ERROR", "Livrez la veille ou le jour de l’événement et récupérez le matériel le jour même ou le lendemain.");
        }
      }
      if (start.getTime() > first || end.getTime() < (requestedDates ? parseDate(lastRentalDay).getTime() : last)) {
        throw new AppError("VALIDATION_ERROR", "La livraison et la récupération doivent couvrir toute la période demandée.");
      }
      // Reserve stock for any additional time that the client will have the equipment.
      if (start.getTime() < first || end.getTime() > last) {
        const extended = mine.map((item) => ({
          productId: item.productId, quantity: item.quantity,
          start: start.getTime() < first ? start : item.startDate,
          end: end.getTime() > last ? end : item.endDate,
        }));
        mine.forEach((item, index) => validateRentalPeriod(settings, item.product, extended[index]));
        await assertAvailable(tx, extended, { excludeHoldUserId: quote.clientId });
        for (const [index, item] of mine.entries()) {
          const change = extended[index];
          await tx.quoteItem.update({
            where: { id: item.id },
            data: {
              startDate: change.start, endDate: change.end,
              requestedStartDate: change.start < item.startDate ? item.startDate : undefined,
              requestedEndDate: change.end > item.endDate ? item.endDate : undefined,
            },
          });
          item.startDate = change.start;
          item.endDate = change.end;
        }
      }
    }
    const deliveryFees = new Map(approval.approvedFees);
    const { priced, totals } = priceOrder(settings, quote.items, quote.fulfillmentType, quote.deliveryCityId, deliveryFees, lenderFulfillment, depositOverrides);
    data.pricingFingerprint = pricingFingerprint(priced, totals, quote.items);
    data.groups = data.groups.map((group) => {
      const plan = fulfillmentFor({ ...quote, lenderFulfillment }, group.lenderId);
      const items = quote.items.filter((item) => item.product.lenderId === group.lenderId);
      const breakdown = totals.byLender.find((b) => b.lenderId === group.lenderId)!;
      const lines: InvoiceLine[] = items.map((item) => {
        const line = priced[quote.items.indexOf(item)];
        return {
          label: item.product.name, detail: `du ${formatDate(item.startDate)} au ${formatDate(item.endDate)}`,
          quantity: line.quantity, days: line.days, unitPrice: line.unitPrice, refundPrice: line.refundPrice, amount: line.subtotal,
        };
      });
      if (breakdown.delivery > 0) lines.push({
        label: "Transport (livraison et récupération)", detail: data.buyer.address ?? undefined,
        quantity: 1, unitPrice: breakdown.delivery, amount: breakdown.delivery,
      });
      return {
        ...group, lines, fulfillment: plan.mode,
        schedule: group.lenderId === actor.lenderId && !("depositOnly" in input)
          ? { ...scheduleOf(items, input.deliverySlot, input.returnSlot), outDate: input.deliveryDate, backDate: input.returnDate }
          : group.schedule ?? scheduleOf(items, plan.deliverySlot ?? null, plan.returnSlot ?? null),
        rental: breakdown.rental, delivery: breakdown.delivery, deposit: breakdown.deposit, cash: breakdown.cash,
      };
    });
    const total = totals.total;
    const netToPay = totals.subtotal + totals.deliveryFee + totals.depositTotal;
    data.totals = { rental: totals.subtotal, delivery: totals.deliveryFee, totalRental: totals.subtotal + totals.deliveryFee, deposit: totals.depositTotal, netToPay, online: total, cash: totals.cashTotal };
    data.notes = quoteNotes(quote.validUntil, totals);
    if (approval.pendingLenderIds.length === 0) {
      await notifyUsers(tx, [quote.clientId], {
        type: "quote.delivery_confirmed",
        title: "Votre proforma est prête",
        body: `Les dates, créneaux et tarifs applicables ont été confirmés pour la proforma ${quote.number}. Vous pouvez vérifier les montants et passer au paiement.`,
        link: `/proformas/${quote.id}`,
      });
    }
    await tx.quote.update({
      where: { id: quoteId },
      data: { total, netToPay, lenderFulfillment: lenderFulfillment ?? undefined, data: data as unknown as Prisma.InputJsonValue },
    });
    await audit(tx, { userId: actor.userId, lenderId: actor.lenderId, action: "quote.delivery_confirm", entity: "Quote", entityId: quoteId, newValue: { ...input, confirmedDeposit: data.groups.find((group) => group.lenderId === actor.lenderId)?.deposit }, meta: actor.meta });
  });
}
