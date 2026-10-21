import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { pageActor } from "@/lib/auth/page";
import { AppError } from "@/lib/errors";
import { formatDate } from "@/lib/dates";
import { formatFcfa, sum } from "@/lib/money";
import { getSettings } from "@/lib/settings";
import { resolveScope } from "@/services/reservations";
import { INVOICE_TITLE, reservationInvoices } from "@/services/invoices";
import { PrintButton } from "@/features/invoices/print-button";
import { reservationHref } from "@/features/invoices/helpers";

export const metadata: Metadata = { title: "Factures de la commande", robots: { index: false } };

export default async function Page({ params }: { params: Promise<{ reservationId: string }> }) {
  const { reservationId } = await params;
  const actor = await pageActor(`/factures/commande/${reservationId}`);
  const scope = await resolveScope(actor, reservationId).catch((e) => {
    if (e instanceof AppError && (e.code === "NOT_FOUND" || e.code === "FORBIDDEN")) return null;
    throw e;
  });
  if (!scope) notFound();
  const [reservation, invoices, settings] = await Promise.all([
    db.reservation.findUniqueOrThrow({ where: { id: reservationId }, include: { client: { select: { firstName: true, lastName: true } } } }),
    reservationInvoices(actor, reservationId),
    getSettings(),
  ]);
  const signed = (i: (typeof invoices)[number]) => (i.kind === "CREDIT_NOTE" ? -i.totalTtc : i.totalTtc);
  const billed = sum(invoices.filter((i) => i.kind !== "CREDIT_NOTE").map((i) => i.totalTtc));
  const credited = sum(invoices.filter((i) => i.kind === "CREDIT_NOTE").map((i) => i.totalTtc));

  return (
    <div className="mx-auto max-w-[210mm] px-4 print:max-w-none print:px-0">
      <style>{`@page { size: A4; margin: 12mm; } @media print { html, body { background: #fff !important; min-height: 0 !important; } main { min-height: 0 !important; } }`}</style>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={reservationHref(actor, reservationId)} className="text-sm font-medium text-[#1f4fd6] hover:underline">Retour</Link>
        <PrintButton />
      </div>
      <article className="bg-white p-[12mm] text-[12px] leading-relaxed text-[#1f2a44] shadow-[0_8px_32px_rgba(15,27,61,0.12)] print:p-0 print:shadow-none">
        <header className="flex flex-wrap items-start justify-between gap-6 border-b-2 border-[#0f1b3d] pb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex size-9 items-center justify-center rounded-[8px] bg-[#1f4fd6] text-[13px] font-bold text-white">LC</span>
              <span className="text-[18px] font-bold tracking-tight text-[#0f1b3d]">LOC&apos;CONNECT</span>
            </div>
            <p className="mt-2 font-medium text-[#0f1b3d]">{settings["invoice.company_name"]}</p>
            <p>{settings["invoice.company_address"]}</p>
          </div>
          <div className="text-right">
            <h1 className="text-[20px] font-bold uppercase tracking-wide text-[#0f1b3d]">Récapitulatif de commande</h1>
            <p className="mt-1 font-mono text-[14px] font-semibold">{reservation.reference}</p>
            <p>Client : {reservation.client.firstName} {reservation.client.lastName}</p>
            <p>Commande du {formatDate(reservation.createdAt)}</p>
          </div>
        </header>
        <p className="mt-4 text-[11px] text-[#5b6478]">
          {scope.kind === "lender" ? "Documents de votre entreprise pour cette commande." : "Chaque loueur facture sa partie de la commande : une facture par loueur, des avoirs en cas d'annulation ou de remboursement, une facture de casse et perte après un constat avec dommages."}
        </p>

        {invoices.length === 0 ? (
          <p className="mt-6 rounded-[8px] bg-[#f4f6fb] p-4">Aucune facture pour le moment : elles sont émises dès la confirmation du paiement.</p>
        ) : (
          <table className="mt-5 w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-[#0f1b3d] text-[10px] uppercase tracking-[0.06em] text-[#5b6478]">
                <th className="py-2 pr-2 font-semibold">Document</th>
                <th className="px-2 py-2 font-semibold">Loueur</th>
                <th className="px-2 py-2 font-semibold">Date</th>
                <th className="py-2 pl-2 text-right font-semibold">Montant TTC</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((i) => (
                <tr key={i.id} className="border-b border-[#e6e9f0]">
                  <td className="py-2 pr-2"><Link href={`/factures/${i.id}`} className="font-medium text-[#1f4fd6] hover:underline">{INVOICE_TITLE[i.kind]} {i.number}</Link></td>
                  <td className="px-2 py-2">{i.lender.companyName}</td>
                  <td className="px-2 py-2">{formatDate(i.issuedAt)}</td>
                  <td className="py-2 pl-2 text-right tabular-nums font-medium">{formatFcfa(signed(i))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="mt-4 flex justify-end">
          <dl className="w-full max-w-[85mm] space-y-1">
            <div className="flex justify-between"><dt>Total facturé</dt><dd className="tabular-nums">{formatFcfa(billed)}</dd></div>
            {credited > 0 && <div className="flex justify-between"><dt>Total des avoirs</dt><dd className="tabular-nums">- {formatFcfa(credited)}</dd></div>}
            <div className="flex justify-between border-t border-[#0f1b3d] pt-1 text-[14px] font-bold text-[#0f1b3d]"><dt>Net</dt><dd className="tabular-nums">{formatFcfa(billed - credited)}</dd></div>
          </dl>
        </div>
        {scope.kind !== "lender" && (
          <p className="mt-5 text-[11px] text-[#5b6478]">
            Payé en ligne à la commande : {formatFcfa(reservation.total)} (dont cautions {formatFcfa(reservation.depositTotal)}, remboursables){reservation.cashTotal > 0 ? ` · à régler en espèces aux loueurs : ${formatFcfa(reservation.cashTotal)}` : ""}.
          </p>
        )}
      </article>
    </div>
  );
}
