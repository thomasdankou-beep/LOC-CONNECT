import Link from "next/link";
import type { ReactNode } from "react";
import { formatFcfa } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import { PAYMENT_METHOD, RETURN_CONDITION } from "@/lib/labels";
import type { InvoiceData, InvoiceParty } from "@/services/invoices";
import { PrintButton } from "./print-button";

export type LiveStatus = { label: string; value: ReactNode; tone?: "ok" | "warn" | "danger" | "muted" };

type Props = {
  title: string;
  number: string | null;
  issuedAt: Date;
  data: InvoiceData;
  vatRateBps: number;
  totalHt: number;
  vatAmount: number;
  totalTtc: number;
  backHref: string;
  /** Bandeau (constat provisoire, document annulé par avoir…). */
  banner?: ReactNode;
  /** Situation du règlement à la date de consultation : ne fait pas partie de la facture figée. */
  live?: LiveStatus[];
  related?: { href: string; label: string }[];
};

const TONE = { ok: "text-[#0f7a3d]", warn: "text-[#9a5700]", danger: "text-[#b42318]", muted: "text-[#5b6478]" };

function Party({ title, party, extra }: { title: string; party: InvoiceParty; extra?: ReactNode }) {
  return (
    <div className="rounded-[8px] border border-[#dfe3ec] p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#5b6478]">{title}</p>
      <p className="mt-1 text-[14px] font-semibold text-[#0f1b3d]">{party.name}</p>
      {party.address && <p>{party.address}</p>}
      {(party.phone || party.email) && <p>{[party.phone, party.email].filter(Boolean).join(" · ")}</p>}
      {party.rccm && <p>RCCM : {party.rccm}</p>}
      {party.ncc && <p>NCC : {party.ncc}</p>}
      {extra}
    </div>
  );
}

/** Facture, avoir ou constat au format A4. Couleurs fixes : le document reste « papier » quel que soit le thème. */
export function InvoiceDocument(p: Props) {
  const d = p.data;
  const hasDays = d.lines.some((l) => l.days != null);
  const vatPct = p.vatRateBps / 100;
  return (
    <div className="mx-auto max-w-[210mm] px-4 print:max-w-none print:px-0">
      <style>{`@page { size: A4; margin: 12mm; } @media print { html, body { background: #fff !important; min-height: 0 !important; } main { min-height: 0 !important; } }`}</style>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={p.backHref} className="text-sm font-medium text-[#1f4fd6] hover:underline">Retour</Link>
        <div className="flex flex-wrap items-center gap-3">
          {p.related?.map((r) => <Link key={r.href} href={r.href} className="text-sm font-medium text-[#1f4fd6] hover:underline">{r.label}</Link>)}
          <PrintButton />
        </div>
      </div>

      <article className="bg-white p-[12mm] text-[12px] leading-relaxed text-[#1f2a44] shadow-[0_8px_32px_rgba(15,27,61,0.12)] print:p-0 print:shadow-none" aria-label={`${p.title}${p.number ? ` ${p.number}` : ""}`}>
        {p.banner && <div className="mb-5 rounded-[8px] border border-[#f0c46b] bg-[#fdf3dc] px-3 py-2 text-[12px] font-medium text-[#7a4a00]">{p.banner}</div>}

        <header className="flex flex-wrap items-start justify-between gap-6 border-b-2 border-[#0f1b3d] pb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex size-9 items-center justify-center rounded-[8px] bg-[#1f4fd6] text-[13px] font-bold text-white">LC</span>
              <span className="text-[18px] font-bold tracking-tight text-[#0f1b3d]">LOC&apos;CONNECT</span>
            </div>
            <p className="mt-2 font-medium text-[#0f1b3d]">{d.platform.name}</p>
            {d.platform.address && <p>{d.platform.address}</p>}
            <p>RCCM : {d.platform.rccm} · NCC : {d.platform.ncc}</p>
            <p>{[d.platform.phone, d.platform.email].filter(Boolean).join(" · ")}</p>
          </div>
          <div className="text-right">
            <h1 className="text-[20px] font-bold uppercase tracking-wide text-[#0f1b3d]">{p.title}</h1>
            <p className="mt-1 text-[14px] font-semibold">{p.number ? `N° ${p.number}` : "Sans numéro (provisoire)"}</p>
            <p>Date : {formatDate(p.issuedAt)}</p>
            {d.reservation && (
              <>
                <p>Réservation : <span className="font-mono">{d.reservation.reference}</span></p>
                <p>{d.reservation.fulfillment === "DELIVERY" ? "Livraison" : "Retrait chez le loueur"}</p>
              </>
            )}
          </div>
        </header>

        {d.issuer === "PLATFORM" ? (
          <section className="mt-5 grid gap-3 sm:grid-cols-2 print:grid-cols-2">
            <Party title="Émetteur" party={d.seller} extra={<p className="mt-1 text-[11px] text-[#5b6478]">{d.seller.vatRegistered ? "Assujetti à la TVA" : "Non assujetti à la TVA"}</p>} />
            <Party title="Loueur facturé" party={d.buyer} />
          </section>
        ) : (
          <>
            <p className="mt-4 text-[11px] text-[#5b6478]">Document émis par {d.platform.name} au nom et pour le compte de {d.seller.name}, dans le cadre d&apos;un mandat de facturation.</p>
            <section className="mt-3 grid gap-3 sm:grid-cols-2 print:grid-cols-2">
              <Party title="Loueur" party={d.seller} extra={<p className="mt-1 text-[11px] text-[#5b6478]">{d.seller.vatRegistered ? "Assujetti à la TVA" : "Non assujetti à la TVA"}</p>} />
              <Party title="Client" party={d.buyer} />
            </section>
          </>
        )}

        {d.credited && (
          <p className="mt-4 rounded-[8px] bg-[#eef2fb] px-3 py-2">
            Avoir sur la facture <strong>N° {d.credited.number}</strong> du {formatDate(d.credited.issuedAt)}. Motif : {d.reason}
          </p>
        )}

        <table className="mt-5 w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-[#0f1b3d] text-[10px] uppercase tracking-[0.06em] text-[#5b6478]">
              <th className="py-2 pr-2 font-semibold">Désignation</th>
              <th className="px-2 py-2 text-right font-semibold">Qté</th>
              {hasDays && <th className="px-2 py-2 text-right font-semibold">Jours</th>}
              <th className="px-2 py-2 text-right font-semibold">Prix unitaire</th>
              <th className="py-2 pl-2 text-right font-semibold">Montant</th>
            </tr>
          </thead>
          <tbody>
            {d.lines.map((l, i) => (
              <tr key={i} className="border-b border-[#e6e9f0] align-top">
                <td className="py-2 pr-2"><span className="font-medium text-[#0f1b3d]">{l.label}</span>{l.detail && <span className="block text-[11px] text-[#5b6478]">{l.detail}</span>}</td>
                <td className="px-2 py-2 text-right tabular-nums">{l.quantity}</td>
                {hasDays && <td className="px-2 py-2 text-right tabular-nums">{l.days ?? ""}</td>}
                <td className="px-2 py-2 text-right tabular-nums">{l.unitPrice != null ? formatFcfa(l.unitPrice) : ""}</td>
                <td className="py-2 pl-2 text-right tabular-nums font-medium">{formatFcfa(l.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 flex justify-end">
          <dl className="w-full max-w-[85mm] space-y-1">
            {p.vatRateBps > 0 ? (
              <>
                <div className="flex justify-between"><dt>Total HT</dt><dd className="tabular-nums">{formatFcfa(p.totalHt)}</dd></div>
                <div className="flex justify-between"><dt>TVA {vatPct} %</dt><dd className="tabular-nums">{formatFcfa(p.vatAmount)}</dd></div>
                <div className="flex justify-between border-t border-[#0f1b3d] pt-1 text-[14px] font-bold text-[#0f1b3d]"><dt>{d.credited ? "Total de l'avoir TTC" : "Total TTC"}</dt><dd className="tabular-nums">{formatFcfa(p.totalTtc)}</dd></div>
              </>
            ) : (
              <>
                <div className="flex justify-between border-t border-[#0f1b3d] pt-1 text-[14px] font-bold text-[#0f1b3d]"><dt>{d.credited ? "Total de l'avoir" : "Total"}</dt><dd className="tabular-nums">{formatFcfa(p.totalTtc)}</dd></div>
                {!d.damage && <p className="text-right text-[11px] text-[#5b6478]">TVA non applicable ({d.issuer === "PLATFORM" ? "émetteur" : "loueur"} non assujetti)</p>}
              </>
            )}
          </dl>
        </div>

        {d.settlement && (
          <section className="mt-5 grid gap-3 sm:grid-cols-2 print:grid-cols-2">
            <div className="rounded-[8px] border border-[#dfe3ec] p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#5b6478]">Règlement</p>
              <p className="mt-1">Payé en ligne : <strong className="tabular-nums">{formatFcfa(d.settlement.onlineAmount)}</strong></p>
              {d.settlement.method && <p className="text-[11px] text-[#5b6478]">{PAYMENT_METHOD[d.settlement.method as keyof typeof PAYMENT_METHOD] ?? d.settlement.method}{d.settlement.paymentReference ? ` · ${d.settlement.paymentReference}` : ""}{d.settlement.paidAt ? ` · ${formatDate(d.settlement.paidAt)}` : ""}</p>}
              {d.settlement.cashAmount > 0 && <p className="mt-1">À régler en espèces au loueur : <strong className="tabular-nums">{formatFcfa(d.settlement.cashAmount)}</strong></p>}
            </div>
            {d.deposit != null && d.deposit > 0 && (
              <div className="rounded-[8px] border border-[#dfe3ec] p-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#5b6478]">Dépôt de garantie (caution)</p>
                <p className="mt-1"><strong className="tabular-nums">{formatFcfa(d.deposit)}</strong> payés en ligne</p>
                <p className="text-[11px] text-[#5b6478]">Remboursable après le constat de retour. Hors facture : ce n&apos;est pas un prix de location.</p>
              </div>
            )}
          </section>
        )}

        {d.damage && (
          <section className="mt-5 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2 print:grid-cols-2">
              <div className="rounded-[8px] border border-[#dfe3ec] p-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#5b6478]">Constat de retour</p>
                <p className="mt-1">Loué {d.damage.rentedQuantity}, rendu {d.damage.returnedQuantity} · état : {RETURN_CONDITION[d.damage.condition as keyof typeof RETURN_CONDITION] ?? d.damage.condition}</p>
                {d.damage.comment && <p className="text-[11px] text-[#5b6478]">« {d.damage.comment} »</p>}
                {d.damage.resolution && <p className="mt-1 text-[11px]">Décision : {d.damage.resolution}</p>}
              </div>
              <div className="rounded-[8px] border border-[#dfe3ec] p-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#5b6478]">Effet sur la caution</p>
                <dl className="mt-1 space-y-0.5">
                  <div className="flex justify-between"><dt>Caution versée</dt><dd className="tabular-nums">{formatFcfa(d.damage.depositAmount)}</dd></div>
                  <div className="flex justify-between"><dt>Retenue sur la caution</dt><dd className="tabular-nums">{formatFcfa(d.damage.withheld)}</dd></div>
                  <div className="flex justify-between"><dt>Restituée au client</dt><dd className="tabular-nums">{formatFcfa(d.damage.released)}</dd></div>
                  <div className="flex justify-between font-semibold text-[#0f1b3d]"><dt>Complément à payer</dt><dd className="tabular-nums">{formatFcfa(d.damage.extraCharge)}</dd></div>
                </dl>
              </div>
            </div>
            {d.damage.photos.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#5b6478]">Photos de preuve</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {d.damage.photos.map((key) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={key} src={`/api/files/${key}`} alt="Preuve du constat" className="h-[30mm] w-[40mm] rounded-[6px] border border-[#dfe3ec] object-cover" />
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {p.live && p.live.length > 0 && (
          <section className="mt-5 rounded-[8px] bg-[#f4f6fb] p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#5b6478]">Situation au {formatDate(new Date())}</p>
            <dl className="mt-1 space-y-0.5">
              {p.live.map((s, i) => (
                <div key={i} className="flex flex-wrap justify-between gap-2"><dt>{s.label}</dt><dd className={TONE[s.tone ?? "muted"]}>{s.value}</dd></div>
              ))}
            </dl>
          </section>
        )}

        {d.notes.length > 0 && (
          <ul className="mt-5 list-disc space-y-0.5 pl-4 text-[11px] text-[#5b6478]">
            {d.notes.map((n, i) => <li key={i}>{n}</li>)}
          </ul>
        )}

        <footer className="mt-8 border-t border-[#dfe3ec] pt-3 text-[10px] text-[#5b6478]">
          {d.platform.name} · {[d.platform.phone, d.platform.email].filter(Boolean).join(" · ")} · Montants en francs CFA (XOF). Document généré par LOC&apos;CONNECT.
        </footer>
      </article>
    </div>
  );
}
