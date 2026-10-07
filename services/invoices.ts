import type { Invoice, InvoiceKind, LenderPaymentMode, Prisma } from "@prisma/client";
import { db, type Tx } from "@/lib/db";
import { AppError, forbidden, notFound } from "@/lib/errors";
import { formatFcfa, sum } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import { getSettings } from "@/lib/settings";
import { can, type Actor } from "@/lib/auth/actor";
import { notifyUsers } from "./notifications";

/**
 * Facturation. LOC'CONNECT émet les factures au nom et pour le compte de chaque loueur (mandat de facturation) :
 *  - facture de location, une par loueur et par paiement (paiement initial ou complément de modification) ;
 *  - facture de casse et perte, une par constat de retour, quand les montants sont arrêtés ;
 *  - avoir, pour toute réduction d'une facture (annulation, baisse par modification, solde impayé, décision de litige).
 * Une facture n'est jamais modifiée : son contenu est figé dans `data` et son numéro suit une séquence sans trou.
 * Les prix du site sont TTC ; pour un loueur assujetti, la TVA est extraite du TTC.
 */

export type InvoiceLine = { label: string; detail?: string; quantity: number; unitPrice: number | null; days?: number; amount: number };
export type InvoiceParty = { name: string; address?: string | null; phone?: string | null; email?: string | null; rccm?: string | null; ncc?: string | null };

export type InvoiceData = {
  title: string;
  platform: InvoiceParty;
  seller: InvoiceParty & { vatRegistered: boolean };
  buyer: InvoiceParty;
  reservation: { reference: string; fulfillment: "PICKUP" | "DELIVERY"; createdAt: string };
  lines: InvoiceLine[];
  /** Facture de location : caution versée (dépôt de garantie, hors facture). */
  deposit?: number;
  /** Facture de location : règlement prévu au moment de l'émission. */
  settlement?: { paymentMode: LenderPaymentMode; onlineAmount: number; cashAmount: number; method?: string | null; paymentReference?: string | null; paidAt?: string | null };
  /** Facture de casse et perte : effet sur la caution. */
  damage?: { depositAmount: number; withheld: number; released: number; extraCharge: number; condition: string; comment?: string | null; photos: string[]; rentedQuantity: number; returnedQuantity: number; resolution?: string | null };
  /** Avoir : facture corrigée et motif. */
  credited?: { number: string; issuedAt: string } | null;
  reason?: string;
  notes: string[];
};

export const INVOICE_TITLE: Record<InvoiceKind, string> = { RENTAL: "Facture de location", DAMAGE: "Facture de casse et perte", CREDIT_NOTE: "Avoir" };

/** Séquence sans trou par préfixe et par année : le compteur est incrémenté dans la transaction qui émet le document. */
async function nextNumber(tx: Tx, prefix: "F" | "AV", now = new Date()): Promise<string> {
  const key = `${prefix}-${now.getUTCFullYear()}`;
  const rows = await tx.$queryRaw<{ last: number }[]>`INSERT INTO "InvoiceSequence" ("key", "last") VALUES (${key}, 1) ON CONFLICT ("key") DO UPDATE SET "last" = "InvoiceSequence"."last" + 1 RETURNING "last"`;
  return `${key}-${String(rows[0].last).padStart(6, "0")}`;
}

/** TVA extraite d'un montant TTC. */
export function splitVat(totalTtc: number, vatRateBps: number): { totalHt: number; vatAmount: number } {
  if (vatRateBps <= 0) return { totalHt: totalTtc, vatAmount: 0 };
  const totalHt = Math.round((totalTtc * 10_000) / (10_000 + vatRateBps));
  return { totalHt, vatAmount: totalTtc - totalHt };
}

async function parties(tx: Tx, reservationId: string, lenderId: string) {
  const settings = await getSettings(tx);
  const reservation = await tx.reservation.findUniqueOrThrow({ where: { id: reservationId }, include: { client: true } });
  const lender = await tx.lender.findUniqueOrThrow({ where: { id: lenderId }, include: { city: true } });
  const platform: InvoiceParty = { name: settings["invoice.company_name"], address: settings["invoice.company_address"], rccm: settings["invoice.company_rccm"], ncc: settings["invoice.company_ncc"], phone: settings["site.support_phone"], email: settings["site.support_email"] };
  const seller = { name: lender.companyName, address: [lender.address, lender.city.name].filter(Boolean).join(", "), phone: lender.phone, email: lender.email, rccm: lender.rccm, ncc: lender.taxNumber, vatRegistered: lender.vatRegistered };
  const buyer: InvoiceParty = { name: `${reservation.client.firstName} ${reservation.client.lastName}`, phone: reservation.contactPhone ?? reservation.client.phone, email: reservation.client.email, address: reservation.deliveryAddress ?? reservation.client.deliveryAddress };
  return {
    settings,
    reservation,
    lender,
    base: { platform, seller, buyer, reservation: { reference: reservation.reference, fulfillment: reservation.fulfillmentType, createdAt: reservation.createdAt.toISOString() } },
  };
}

async function createInvoice(
  tx: Tx,
  p: { kind: InvoiceKind; sourceKey: string; reservationId: string; lenderId: string; clientId: string; paymentId?: string | null; creditedInvoiceId?: string | null; vatRateBps: number; totalTtc: number; data: InvoiceData },
): Promise<{ invoice: Invoice; created: boolean }> {
  const existing = await tx.invoice.findUnique({ where: { sourceKey: p.sourceKey } });
  if (existing) return { invoice: existing, created: false };
  const { totalHt, vatAmount } = splitVat(p.totalTtc, p.vatRateBps);
  const invoice = await tx.invoice.create({
    data: {
      number: await nextNumber(tx, p.kind === "CREDIT_NOTE" ? "AV" : "F"),
      kind: p.kind,
      sourceKey: p.sourceKey,
      reservationId: p.reservationId,
      lenderId: p.lenderId,
      clientId: p.clientId,
      paymentId: p.paymentId ?? null,
      creditedInvoiceId: p.creditedInvoiceId ?? null,
      vatRateBps: p.vatRateBps,
      totalHt,
      vatAmount,
      totalTtc: p.totalTtc,
      data: p.data as unknown as Prisma.InputJsonValue,
    },
  });
  return { invoice, created: true };
}

const period = (start: Date, end: Date) => `du ${formatDate(start)} au ${formatDate(end)}`;

/** Factures de location émises à la confirmation du paiement initial : une par loueur. */
export async function issueRentalInvoices(tx: Tx, reservationId: string, paymentId: string) {
  const reservation = await tx.reservation.findUniqueOrThrow({ where: { id: reservationId }, include: { items: { orderBy: { createdAt: "asc" } }, deliveries: true, cashSettlements: true } });
  const payment = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
  const issued: Invoice[] = [];
  for (const lenderId of [...new Set(reservation.items.map((i) => i.lenderId))]) {
    const mine = reservation.items.filter((i) => i.lenderId === lenderId);
    const { settings, lender, base } = await parties(tx, reservationId, lenderId);
    const delivery = reservation.deliveries.find((d) => d.lenderId === lenderId);
    const lines: InvoiceLine[] = mine.map((i) => ({ label: i.productName, detail: period(i.startDate, i.endDate), quantity: i.quantity, days: i.days, unitPrice: i.unitPrice, amount: i.subtotal }));
    if (delivery && delivery.fee > 0) lines.push({ label: "Livraison", detail: delivery.address ?? undefined, quantity: 1, unitPrice: delivery.fee, amount: delivery.fee });
    const total = sum(lines.map((l) => l.amount));
    const cashAmount = sum(mine.map((i) => i.cashDue)) + (reservation.cashSettlements.find((c) => c.lenderId === lenderId)?.deliveryDue ?? 0);
    const paymentMode = mine[0].paymentMode;
    const notes = paymentMode === "DEPOSIT_CASH" ? [`Acompte de ${formatFcfa(total - cashAmount)} payé en ligne. Solde de ${formatFcfa(cashAmount)} à régler en espèces au loueur à la remise du matériel, contre le code de remise du client.`] : [];
    const { invoice, created } = await createInvoice(tx, {
      kind: "RENTAL",
      sourceKey: `RENTAL:${paymentId}:${lenderId}`,
      reservationId,
      lenderId,
      clientId: reservation.clientId,
      paymentId,
      vatRateBps: lender.vatRegistered ? settings["invoice.vat_rate_bps"] : 0,
      totalTtc: total,
      data: {
        ...base,
        title: INVOICE_TITLE.RENTAL,
        lines,
        deposit: sum(mine.map((i) => i.depositAmount)),
        settlement: { paymentMode, onlineAmount: total - cashAmount, cashAmount, method: payment.method, paymentReference: payment.reference, paidAt: (payment.paidAt ?? new Date()).toISOString() },
        notes,
      },
    });
    if (created) issued.push(invoice);
  }
  if (issued.length) {
    await notifyUsers(tx, [reservation.clientId], {
      type: "invoice.issued",
      title: issued.length > 1 ? `Vos ${issued.length} factures sont disponibles` : `Votre facture ${issued[0].number} est disponible`,
      body: `Réservation ${reservation.reference} : factures consultables et imprimables en PDF.`,
      link: `/factures/commande/${reservationId}`,
    });
  }
  return issued;
}

/** Première facture de location d'un loueur pour une réservation (celle que corrigent les avoirs). */
async function rentalInvoiceOf(tx: Tx, reservationId: string, lenderId: string) {
  return tx.invoice.findFirst({ where: { reservationId, lenderId, kind: "RENTAL" }, orderBy: { issuedAt: "asc" } });
}

/** Avoir : réduction d'une facture de location. Sans facture d'origine ou sans montant, rien n'est émis. */
export async function issueCreditNote(tx: Tx, p: { sourceKey: string; reservationId: string; lenderId: string; lines: InvoiceLine[]; reason: string; notes?: string[] }) {
  const lines = p.lines.filter((l) => l.amount !== 0);
  const total = sum(lines.map((l) => l.amount));
  if (total <= 0) return null;
  const original = await rentalInvoiceOf(tx, p.reservationId, p.lenderId);
  if (!original) return null;
  const { base, reservation } = await parties(tx, p.reservationId, p.lenderId);
  const { invoice, created } = await createInvoice(tx, {
    kind: "CREDIT_NOTE",
    sourceKey: p.sourceKey,
    reservationId: p.reservationId,
    lenderId: p.lenderId,
    clientId: reservation.clientId,
    creditedInvoiceId: original.id,
    vatRateBps: original.vatRateBps,
    totalTtc: total,
    data: { ...base, title: INVOICE_TITLE.CREDIT_NOTE, lines, credited: { number: original.number, issuedAt: original.issuedAt.toISOString() }, reason: p.reason, notes: p.notes ?? [] },
  });
  if (created) {
    await notifyUsers(tx, [reservation.clientId], { type: "invoice.credit_note", title: `Avoir ${invoice.number}`, body: `${formatFcfa(total)} au crédit de la facture ${original.number} : ${p.reason}`, link: `/factures/${invoice.id}` });
  }
  return invoice;
}

/** Modification appliquée : facture du supplément de location, ou avoir de la baisse. */
export async function issueModificationDocument(tx: Tx, modificationId: string) {
  const mod = await tx.modificationRequest.findUniqueOrThrow({ where: { id: modificationId }, include: { lines: true } });
  const products = await tx.product.findMany({ where: { id: { in: mod.lines.map((l) => l.productId) } }, select: { id: true, name: true } });
  const name = (id: string) => products.find((p) => p.id === id)?.name ?? "Article";
  const describe = (l: (typeof mod.lines)[number]) =>
    l.action === "ADD"
      ? { label: `Ajout : ${name(l.productId)}`, detail: `${l.quantityRequested} x, ${period(l.startAfter!, l.endAfter!)}` }
      : l.action === "REMOVE"
        ? { label: `Retrait : ${name(l.productId)}`, detail: `${l.quantityBefore} x, ${period(l.startBefore!, l.endBefore!)}` }
        : { label: `Modification : ${name(l.productId)}`, detail: `${l.quantityBefore} x ${period(l.startBefore!, l.endBefore!)}, devient ${l.quantityRequested} x ${period(l.startAfter!, l.endAfter!)}` };
  const delta = mod.amountAfter - mod.amountBefore;
  if (delta > 0) {
    const { settings, lender, base, reservation } = await parties(tx, mod.reservationId, mod.lenderId);
    const lines = mod.lines.map((l) => ({ ...describe(l), quantity: 1, unitPrice: l.subtotalAfter - l.subtotalBefore, amount: l.subtotalAfter - l.subtotalBefore }));
    const cash = mod.cashAfter - mod.cashBefore;
    const payment = mod.paymentId ? await tx.payment.findUnique({ where: { id: mod.paymentId } }) : null;
    const original = await rentalInvoiceOf(tx, mod.reservationId, mod.lenderId);
    const { invoice } = await createInvoice(tx, {
      kind: "RENTAL",
      sourceKey: `MOD:${mod.id}`,
      reservationId: mod.reservationId,
      lenderId: mod.lenderId,
      clientId: reservation.clientId,
      paymentId: mod.paymentId,
      vatRateBps: original?.vatRateBps ?? (lender.vatRegistered ? settings["invoice.vat_rate_bps"] : 0),
      totalTtc: delta,
      data: {
        ...base,
        title: INVOICE_TITLE.RENTAL,
        lines,
        deposit: Math.max(0, mod.depositAfter - mod.depositBefore),
        settlement: { paymentMode: cash > 0 ? "DEPOSIT_CASH" : "ONLINE_FULL", onlineAmount: delta - Math.max(0, cash), cashAmount: Math.max(0, cash), method: payment?.method, paymentReference: payment?.reference, paidAt: payment?.paidAt?.toISOString() ?? null },
        notes: [`Complément suite à la modification de la réservation${original ? ` (facture d'origine ${original.number})` : ""}.`],
      },
    });
    await notifyUsers(tx, [reservation.clientId], { type: "invoice.issued", title: `Facture ${invoice.number}`, body: `Facture du complément de location (${formatFcfa(delta)}).`, link: `/factures/${invoice.id}` });
    return invoice;
  }
  if (delta < 0) {
    return issueCreditNote(tx, {
      sourceKey: `CREDIT:MOD:${mod.id}`,
      reservationId: mod.reservationId,
      lenderId: mod.lenderId,
      lines: mod.lines.map((l) => ({ ...describe(l), quantity: 1, unitPrice: l.subtotalBefore - l.subtotalAfter, amount: l.subtotalBefore - l.subtotalAfter })),
      reason: "Réduction de la réservation par modification",
    });
  }
  return null;
}

/** Facture de casse et perte, émise quand les montants du constat sont arrêtés (accepté, délai écoulé ou décision). */
export async function issueDamageInvoice(tx: Tx, reportId: string, amounts: { accepted: number; withheld: number; released: number; extraCharge: number; resolution?: string | null }) {
  if (amounts.accepted <= 0) return null;
  const report = await tx.returnReport.findUniqueOrThrow({ where: { id: reportId }, include: { photos: true, item: { include: { deposit: true } } } });
  const item = report.item;
  const { base, reservation } = await parties(tx, item.reservationId, item.lenderId);
  const lines: InvoiceLine[] = [];
  if (report.lostQuantity > 0) lines.push({ label: `${item.productName} : unités perdues ou détruites`, detail: "Prix de remboursement convenu à la réservation", quantity: report.lostQuantity, unitPrice: report.refundPrice, amount: report.lostQuantity * report.refundPrice });
  if (report.damagedQuantity > 0 && report.damageAmount > 0) lines.push({ label: `${item.productName} : unités endommagées`, detail: "Réparations estimées par le loueur", quantity: report.damagedQuantity, unitPrice: null, amount: report.damageAmount });
  const declared = sum(lines.map((l) => l.amount));
  if (amounts.accepted !== declared) lines.push({ label: "Ajustement après accord ou arbitrage", quantity: 1, unitPrice: null, amount: amounts.accepted - declared });
  const { invoice, created } = await createInvoice(tx, {
    kind: "DAMAGE",
    sourceKey: `DAMAGE:${reportId}`,
    reservationId: item.reservationId,
    lenderId: item.lenderId,
    clientId: reservation.clientId,
    vatRateBps: 0,
    totalTtc: amounts.accepted,
    data: {
      ...base,
      title: INVOICE_TITLE.DAMAGE,
      lines,
      damage: { depositAmount: item.deposit?.amount ?? 0, withheld: amounts.withheld, released: amounts.released, extraCharge: amounts.extraCharge, condition: report.condition, comment: report.comment, photos: report.photos.map((p) => p.storageKey), rentedQuantity: report.rentedQuantity, returnedQuantity: report.returnedQuantity, resolution: amounts.resolution ?? null },
      notes: ["Indemnités de casse et de perte : hors champ de la TVA.", "Le montant est d'abord prélevé sur la caution ; un éventuel complément est facturé au client si le produit l'autorise."],
    },
  });
  if (created) {
    await notifyUsers(tx, [reservation.clientId], { type: "invoice.damage", title: `Facture de casse et perte ${invoice.number}`, body: `${formatFcfa(amounts.accepted)} de dommages : ${formatFcfa(amounts.withheld)} retenus sur la caution${amounts.extraCharge > 0 ? `, ${formatFcfa(amounts.extraCharge)} de complément` : ""}.`, link: `/factures/${invoice.id}` });
  }
  return invoice;
}

// ---------------------------------------------------------------------------
// Lecture et droits
// ---------------------------------------------------------------------------

const LENDER_PERMS = ["FINANCE_VIEW", "DEPOSIT_VIEW"];
const ADMIN_PERMS = ["ADMIN_PAYMENTS", "ADMIN_RESERVATIONS", "ADMIN_DEPOSITS"];

export function canSeeInvoices(actor: Actor): boolean {
  if (actor.accountType === "CLIENT") return true;
  if (actor.accountType === "LENDER") return LENDER_PERMS.some((p) => can(actor, p));
  return ADMIN_PERMS.some((p) => can(actor, p));
}

/** Filtre d'accès : le client voit ses documents, le loueur les siens, l'administration tout. */
export function invoiceScope(actor: Actor): Prisma.InvoiceWhereInput {
  if (!canSeeInvoices(actor)) throw forbidden("Votre rôle ne permet pas de consulter les factures.");
  if (actor.accountType === "CLIENT") return { clientId: actor.userId };
  if (actor.accountType === "LENDER") return { lenderId: actor.lenderId ?? "none" };
  return {};
}

export async function getInvoiceForActor(actor: Actor, id: string) {
  const invoice = await db.invoice.findFirst({ where: { id, ...invoiceScope(actor) }, include: { reservation: { select: { id: true, reference: true } } } });
  if (!invoice) throw notFound("Facture");
  const credited = invoice.creditedInvoiceId ? await db.invoice.findUnique({ where: { id: invoice.creditedInvoiceId }, select: { id: true, number: true } }) : null;
  const creditNotes = await db.invoice.findMany({ where: { creditedInvoiceId: invoice.id }, select: { id: true, number: true, totalTtc: true, issuedAt: true }, orderBy: { issuedAt: "asc" } });
  return { invoice, data: invoice.data as unknown as InvoiceData, credited, creditNotes };
}

export async function listInvoices(actor: Actor, opts: { q?: string; kind?: InvoiceKind; page?: number; pageSize?: number } = {}) {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = opts.pageSize ?? 20;
  const where: Prisma.InvoiceWhereInput = {
    ...invoiceScope(actor),
    ...(opts.kind ? { kind: opts.kind } : {}),
    ...(opts.q ? { OR: [{ number: { contains: opts.q, mode: "insensitive" } }, { reservation: { reference: { contains: opts.q, mode: "insensitive" } } }, { lender: { companyName: { contains: opts.q, mode: "insensitive" } } }] } : {}),
  };
  const [total, rows] = await Promise.all([
    db.invoice.count({ where }),
    db.invoice.findMany({ where, include: { reservation: { select: { id: true, reference: true } }, lender: { select: { companyName: true } } }, orderBy: { issuedAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
  ]);
  return { rows, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

/** Documents d'une réservation visibles par l'acteur (récapitulatif de commande, boutons des pages de réservation). */
export async function reservationInvoices(actor: Actor, reservationId: string) {
  if (!canSeeInvoices(actor)) return [];
  return db.invoice.findMany({ where: { reservationId, ...invoiceScope(actor) }, include: { lender: { select: { companyName: true } } }, orderBy: [{ lenderId: "asc" }, { issuedAt: "asc" }] });
}

/** Constat de casse et perte : provisoire tant que les montants ne sont pas arrêtés, avec lien vers la facture définitive. */
export async function getDamageStatementForActor(actor: Actor, itemId: string) {
  const item = await db.reservationItem.findUnique({
    where: { id: itemId },
    include: { returnReport: { include: { photos: true } }, deposit: true, extraCharges: true, lender: { include: { city: true } }, reservation: { include: { client: true } } },
  });
  if (!item || !item.returnReport) throw notFound("Constat de retour");
  const allowed =
    (actor.accountType === "CLIENT" && item.reservation.clientId === actor.userId) ||
    (actor.accountType === "LENDER" && item.lenderId === actor.lenderId && LENDER_PERMS.some((p) => can(actor, p))) ||
    (actor.accountType === "ADMIN" && ADMIN_PERMS.some((p) => can(actor, p)));
  if (!allowed) throw forbidden();
  const invoice = await db.invoice.findUnique({ where: { sourceKey: `DAMAGE:${item.returnReport.id}` }, select: { id: true, number: true } });
  return { item, report: item.returnReport, invoice };
}

export function assertInvoiceKind(kind: string | undefined): InvoiceKind | undefined {
  if (!kind) return undefined;
  if (!["RENTAL", "DAMAGE", "CREDIT_NOTE"].includes(kind)) throw new AppError("VALIDATION_ERROR", "Type de document inconnu.");
  return kind as InvoiceKind;
}
