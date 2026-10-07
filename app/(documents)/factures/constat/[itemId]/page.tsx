import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { pageActor } from "@/lib/auth/page";
import { AppError } from "@/lib/errors";
import { formatDateTime } from "@/lib/dates";
import { getSettings } from "@/lib/settings";
import { getDamageStatementForActor, type InvoiceData, type InvoiceLine } from "@/services/invoices";
import { InvoiceDocument } from "@/features/invoices/invoice-document";
import { reservationHref } from "@/features/invoices/helpers";

export const metadata: Metadata = { title: "Constat de casse et perte", robots: { index: false } };

/** Constat provisoire : visible dès la déclaration du loueur ; une fois les montants arrêtés, renvoie vers la facture définitive. */
export default async function Page({ params }: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await params;
  const actor = await pageActor(`/factures/constat/${itemId}`);
  const r = await getDamageStatementForActor(actor, itemId).catch((e) => {
    if (e instanceof AppError && (e.code === "NOT_FOUND" || e.code === "FORBIDDEN")) return null;
    throw e;
  });
  if (!r) notFound();
  if (r.invoice) redirect(`/factures/${r.invoice.id}`);
  const { item, report } = r;
  const settings = await getSettings();

  const lines: InvoiceLine[] = [];
  if (report.lostQuantity > 0) lines.push({ label: `${item.productName} : unités perdues ou détruites`, detail: "Prix de remboursement convenu à la réservation", quantity: report.lostQuantity, unitPrice: report.refundPrice, amount: report.lostQuantity * report.refundPrice });
  if (report.damagedQuantity > 0 && report.damageAmount > 0) lines.push({ label: `${item.productName} : unités endommagées`, detail: "Réparations estimées par le loueur", quantity: report.damagedQuantity, unitPrice: null, amount: report.damageAmount });
  const total = lines.reduce((a, l) => a + l.amount, 0);
  const deposit = item.deposit?.amount ?? 0;

  const data: InvoiceData = {
    title: "Constat de casse et perte",
    platform: { name: settings["invoice.company_name"], address: settings["invoice.company_address"], rccm: settings["invoice.company_rccm"], ncc: settings["invoice.company_ncc"], phone: settings["site.support_phone"], email: settings["site.support_email"] },
    seller: { name: item.lender.companyName, address: [item.lender.address, item.lender.city.name].filter(Boolean).join(", "), phone: item.lender.phone, email: item.lender.email, rccm: item.lender.rccm, ncc: item.lender.taxNumber, vatRegistered: item.lender.vatRegistered },
    buyer: { name: `${item.reservation.client.firstName} ${item.reservation.client.lastName}`, phone: item.reservation.contactPhone ?? item.reservation.client.phone, email: item.reservation.client.email },
    reservation: { reference: item.reservation.reference, fulfillment: item.reservation.fulfillmentType, createdAt: item.reservation.createdAt.toISOString() },
    lines,
    damage: { depositAmount: deposit, withheld: report.withheldAmount, released: deposit - report.withheldAmount, extraCharge: report.extraChargeAmount, condition: report.condition, comment: report.comment, photos: report.photos.map((p) => p.storageKey), rentedQuantity: report.rentedQuantity, returnedQuantity: report.returnedQuantity },
    notes: ["Montants déclarés par le loueur, non définitifs.", "La facture de casse et perte numérotée sera émise quand les montants seront arrêtés : acceptation du client, fin du délai de contestation ou décision de LOC'CONNECT."],
  };
  const banner =
    report.status === "CONTESTED"
      ? `Constat contesté par le client${report.contestedAt ? ` le ${formatDateTime(report.contestedAt)}` : ""} : la caution est gelée en attendant la décision de LOC'CONNECT.`
      : total === 0
        ? "Retour conforme : aucune somme n'est due."
        : `Constat provisoire : le client peut l'accepter ou le contester${report.contestDeadline ? ` jusqu'au ${formatDateTime(report.contestDeadline)}` : ""}.`;

  return (
    <InvoiceDocument
      title="Constat de casse et perte"
      number={null}
      issuedAt={report.createdAt}
      data={data}
      vatRateBps={0}
      totalHt={total}
      vatAmount={0}
      totalTtc={total}
      backHref={reservationHref(actor, item.reservationId)}
      banner={banner}
    />
  );
}
