import Link from "next/link";
import type { ReactNode } from "react";
import { formatFcfa } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import { PAYMENT_MODE } from "@/lib/labels";
import type { InvoiceParty } from "@/services/invoices";
import type { QuoteData } from "@/services/quotes";
import { ScheduleLines } from "./invoice-document";
import { PrintButton } from "./print-button";
import { AcceptanceBox, LegalFooter, LenderHeader, TermsSection } from "./document-parts";

function Party({ title, party }: { title: string; party: InvoiceParty }) {
  return (
    <div className="rounded-[8px] border border-[#dfe3ec] p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#5b6478]">{title}</p>
      <p className="mt-1 text-[14px] font-semibold text-[#0f1b3d]">{party.name}</p>
      {party.address && <p>{party.address}</p>}
      {(party.phone || party.email) && <p>{[party.phone, party.email].filter(Boolean).join(" · ")}</p>}
      {party.rccm && <p>RCCM : {party.rccm}</p>}
      {party.event && <p className="mt-1">Événement : <strong>{party.event}</strong></p>}
    </div>
  );
}

const Row = ({ label, value, strong }: { label: ReactNode; value: number; strong?: boolean }) => (
  <div className={strong ? "flex justify-between border-t border-[#0f1b3d] pt-1 text-[14px] font-bold text-[#0f1b3d]" : "flex justify-between"}>
    <dt>{label}</dt>
    <dd className="tabular-nums">{formatFcfa(value)}</dd>
  </div>
);

/** Proforma au format A4, sur le modèle des proformas papier des loueurs : prix de remboursement, transport, caution, net à payer. */
export function QuoteDocument({ number, createdAt, validUntil, acceptedAt, data, backHref, banner, action }: { number: string; createdAt: Date; validUntil: Date; acceptedAt: Date | null; data: QuoteData; backHref: string; banner?: ReactNode; action?: ReactNode }) {
  // Proforma d'un seul loueur : présentée à son nom, comme ses documents papier.
  const single = data.groups.length === 1;
  const seller = data.groups[0].seller;
  const t = data.totals;
  return (
    <div className="mx-auto max-w-[210mm] px-4 print:max-w-none print:px-0">
      <style>{`@page { size: A4; margin: 12mm; } @media print { html, body { background: #fff !important; min-height: 0 !important; } main { min-height: 0 !important; } }`}</style>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3 print:hidden">
        <Link href={backHref} className="text-sm font-medium text-[#1f4fd6] hover:underline">Retour</Link>
        <div className="flex flex-wrap items-start gap-3">
          <PrintButton />
          {action}
        </div>
      </div>

      <article className="bg-white p-[12mm] text-[12px] leading-relaxed text-[#1f2a44] shadow-[0_8px_32px_rgba(15,27,61,0.12)] print:p-0 print:shadow-none" aria-label={`Proforma ${number}`}>
        {banner && <div className="mb-5 rounded-[8px] border border-[#f0c46b] bg-[#fdf3dc] px-3 py-2 text-[12px] font-medium text-[#7a4a00] print:hidden">{banner}</div>}

        <div className="grid grid-cols-1 items-start gap-6 border-b-2 border-[#0f1b3d] pb-5 sm:grid-cols-[minmax(0,1fr)_auto] print:grid-cols-[minmax(0,1fr)_auto]">
          {single ? (
            <LenderHeader party={seller} />
          ) : (
            <div>
              <div className="flex items-center gap-2">
                <span className="flex size-9 items-center justify-center rounded-[8px] bg-[#1f4fd6] text-[13px] font-bold text-white">LC</span>
                <span className="text-[18px] font-bold tracking-tight text-[#0f1b3d]">LOC&apos;CONNECT</span>
              </div>
              <p className="mt-2 font-medium text-[#0f1b3d]">{data.platform.name}</p>
              {data.platform.address && <p>{data.platform.address}</p>}
              <p>{[data.platform.phone, data.platform.email].filter(Boolean).join(" · ")}</p>
            </div>
          )}
          <div className="text-right">
            <h1 className="text-[20px] font-bold uppercase tracking-wide text-[#0f1b3d]">Proforma</h1>
            <p className="mt-1 text-[14px] font-semibold">N° {number}</p>
            <p>Date : {formatDate(createdAt)}</p>
            <p>Valable jusqu&apos;au {formatDate(validUntil)}</p>
            <ScheduleLines schedule={data.schedule} fulfillment={data.fulfillment} />
          </div>
        </div>

        <section className="mt-5 grid gap-3 sm:grid-cols-2 print:grid-cols-2">
          <Party title="Client" party={data.buyer} />
        </section>

        {data.groups.map((g, gi) => (
          <section key={gi} className="mt-5">
            {!single && <h2 className="text-[13px] font-semibold text-[#0f1b3d]">{g.seller.name}{g.seller.phone ? <span className="font-normal text-[#5b6478]"> · {g.seller.phone}</span> : null}</h2>}
            <table className="mt-2 w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-[#0f1b3d] text-[10px] uppercase tracking-[0.06em] text-[#5b6478]">
                  <th className="py-2 pr-2 font-semibold">Désignation</th>
                  <th className="px-2 py-2 text-right font-semibold">Prix de remboursement</th>
                  <th className="px-2 py-2 text-right font-semibold">Prix unitaire</th>
                  <th className="px-2 py-2 text-right font-semibold">Qté</th>
                  <th className="px-2 py-2 text-right font-semibold">Jours</th>
                  <th className="py-2 pl-2 text-right font-semibold">Total</th>
                </tr>
              </thead>
              <tbody>
                {g.lines.map((l, i) => (
                  <tr key={i} className="border-b border-[#e6e9f0] align-top">
                    <td className="py-2 pr-2"><span className="font-medium text-[#0f1b3d]">{l.label}</span>{l.detail && <span className="block text-[11px] text-[#5b6478]">{l.detail}</span>}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-[#5b6478]">{l.refundPrice != null ? formatFcfa(l.refundPrice) : ""}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{l.unitPrice != null ? formatFcfa(l.unitPrice) : ""}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{l.quantity}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{l.days ?? ""}</td>
                    <td className="py-2 pl-2 text-right tabular-nums font-medium">{formatFcfa(l.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!single && (
              <p className="mt-1 text-right text-[11px] text-[#5b6478]">
                Location et transport {formatFcfa(g.rental + g.delivery)} · caution {formatFcfa(g.deposit)} · {PAYMENT_MODE[g.paymentMode].short}
                {g.cash > 0 ? ` · ${formatFcfa(g.cash)} en espèces à la remise` : ""}
              </p>
            )}
          </section>
        ))}

        <div className="mt-5 flex justify-end">
          <dl className="w-full max-w-[95mm] space-y-1">
            <Row label="Location" value={t.rental} />
            {t.delivery > 0 && <Row label="Transport" value={t.delivery} />}
            <Row label="Total location" value={t.totalRental} strong />
            <Row label="Caution (remboursable)" value={t.deposit} />
            <div className="flex justify-between rounded-[6px] bg-[#0f1b3d] px-2 py-1.5 text-[15px] font-bold text-white">
              <dt>Net à payer</dt>
              <dd className="tabular-nums">{formatFcfa(t.netToPay)}</dd>
            </div>
            {t.cash > 0 && (
              <div className="space-y-0.5 pt-1 text-[11px]">
                <Row label="Acompte payé en ligne à la commande" value={t.online} />
                <Row label="Solde en espèces au loueur, à la remise" value={t.cash} />
              </div>
            )}
          </dl>
        </div>

        {data.notes.length > 0 && (
          <ul className="mt-5 list-disc space-y-0.5 pl-4 text-[11px] text-[#5b6478]">
            {data.notes.map((n, i) => <li key={i}>{n}</li>)}
          </ul>
        )}

        <AcceptanceBox buyerName={data.buyer.name} acceptedAt={acceptedAt} pendingLabel="« Lu et approuvé » : à cocher au moment du paiement, à la place de la signature." />

        {single ? (
          <LegalFooter seller={seller} platform={data.platform} />
        ) : (
          <div className="mt-8 border-t border-[#dfe3ec] pt-3 text-[10px] text-[#5b6478]">
            {data.platform.name} · {[data.platform.phone, data.platform.email].filter(Boolean).join(" · ")} · Montants en francs CFA (XOF). Document généré par LOC&apos;CONNECT.
          </div>
        )}
        {data.groups.filter((g) => g.terms).map((g, i) => <TermsSection key={i} sellerName={g.seller.name} terms={g.terms!} date={createdAt} />)}
      </article>
    </div>
  );
}
