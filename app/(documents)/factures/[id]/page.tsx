import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { pageActor } from "@/lib/auth/page";
import { AppError } from "@/lib/errors";
import { formatDate } from "@/lib/dates";
import { formatFcfa } from "@/lib/money";
import { CASH_STATUS, PAYMENT_STATUS } from "@/lib/labels";
import { getInvoiceForActor } from "@/services/invoices";
import { InvoiceDocument, type LiveStatus } from "@/features/invoices/invoice-document";
import { invoicesHref, reservationHref } from "@/features/invoices/helpers";

export const metadata: Metadata = { title: "Facture", robots: { index: false } };

const toneOf = (t: string) => (t === "success" ? "ok" : t === "danger" ? "danger" : t === "warning" ? "warn" : "muted") as LiveStatus["tone"];

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await pageActor(`/factures/${id}`);
  const r = await getInvoiceForActor(actor, id).catch((e) => {
    if (e instanceof AppError && (e.code === "NOT_FOUND" || e.code === "FORBIDDEN")) return null;
    throw e;
  });
  if (!r) notFound();
  const { invoice, data, credited, creditNotes } = r;

  const live: LiveStatus[] = [];
  if (invoice.kind === "RENTAL") {
    const payment = invoice.paymentId ? await db.payment.findUnique({ where: { id: invoice.paymentId } }) : null;
    if (payment) live.push({ label: `Paiement en ligne ${payment.reference}`, value: PAYMENT_STATUS[payment.status].label, tone: toneOf(PAYMENT_STATUS[payment.status].tone) });
    const cash = invoice.reservationId && data.settlement && data.settlement.cashAmount > 0 ? await db.cashSettlement.findUnique({ where: { reservationId_lenderId: { reservationId: invoice.reservationId!, lenderId: invoice.lenderId } } }) : null;
    if (cash) live.push({ label: "Solde en espèces", value: `${CASH_STATUS[cash.status].label}${cash.confirmedAt ? ` le ${formatDate(cash.confirmedAt)}` : ""}`, tone: toneOf(CASH_STATUS[cash.status].tone) });
  }
  if (invoice.kind === "DAMAGE") {
    const reportId = invoice.sourceKey.replace("DAMAGE:", "");
    const charges = await db.extraCharge.findMany({ where: { reportId } });
    for (const c of charges) live.push({ label: `Complément de ${formatFcfa(c.amount)}`, value: c.status === "PAID" ? "Payé" : c.status === "PENDING" ? "À régler depuis la réservation" : c.status === "WAIVED" ? "Abandonné" : "Annulé", tone: c.status === "PAID" ? "ok" : c.status === "PENDING" ? "warn" : "muted" });
  }
  for (const c of creditNotes) live.push({ label: `Avoir ${c.number} du ${formatDate(c.issuedAt)}`, value: `- ${formatFcfa(c.totalTtc)}`, tone: "muted" });

  const related = [
    ...(invoice.reservationId ? [{ href: `/factures/commande/${invoice.reservationId}`, label: "Toutes les factures de la commande" }] : []),
    ...(credited ? [{ href: `/factures/${credited.id}`, label: `Facture ${credited.number}` }] : []),
  ];

  return (
    <InvoiceDocument
      title={data.title}
      number={invoice.number}
      issuedAt={invoice.issuedAt}
      data={data}
      vatRateBps={invoice.vatRateBps}
      totalHt={invoice.totalHt}
      vatAmount={invoice.vatAmount}
      totalTtc={invoice.totalTtc}
      backHref={invoice.reservationId ? reservationHref(actor, invoice.reservationId) : invoice.kind === "SUBSCRIPTION" && actor.accountType === "LENDER" ? "/loueur/abonnement" : invoicesHref(actor)}
      live={live}
      related={related}
    />
  );
}
