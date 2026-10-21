import { formatFcfa } from "@/lib/money";
import { formatDate, formatDateTime } from "@/lib/dates";
import type { InvoiceParty } from "@/services/invoices";

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");

/** Mentions légales d'une entreprise : capital, RCCM, NCC. */
export function legalLine(p: InvoiceParty): string {
  return [p.shareCapital != null ? `Capital social : ${formatFcfa(p.shareCapital)}` : null, p.rccm ? `RCCM : ${p.rccm}` : null, p.ncc ? `NCC : ${p.ncc}` : null].filter(Boolean).join(" · ");
}

/** En-tête au nom du loueur : son logo, son siège et ses mentions légales, comme sur ses documents papier. */
export function LenderHeader({ party, extra }: { party: InvoiceParty; extra?: React.ReactNode }) {
  return (
    <div className="min-w-0 break-words">
      <div className="flex items-center gap-3">
        {party.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={party.logoUrl} alt={`Logo ${party.name}`} className="h-[16mm] max-w-[45mm] object-contain" />
        ) : (
          <span className="flex size-10 items-center justify-center rounded-[8px] bg-[#0f1b3d] text-[13px] font-bold text-white">{initials(party.name)}</span>
        )}
        <span className="text-[18px] font-bold tracking-tight text-[#0f1b3d]">{party.name}</span>
      </div>
      {party.address && <p className="mt-2">{party.address}</p>}
      {party.postalAddress && <p>{party.postalAddress}</p>}
      {(party.phone || party.email) && <p>{[party.phone, party.email].filter(Boolean).join(" · ")}</p>}
      {legalLine(party) && <p>{legalLine(party)}</p>}
      {extra}
    </div>
  );
}

/** Pied de page légal du loueur, suivi de la mention LOC'CONNECT. */
export function LegalFooter({ seller, platform }: { seller: InvoiceParty; platform: InvoiceParty }) {
  const siege = [seller.address ? `Siège : ${seller.address}` : null, seller.postalAddress, legalLine(seller), seller.email].filter(Boolean).join(" | ");
  return (
    <div className="mt-8 border-t border-[#dfe3ec] pt-3 text-center text-[10px] text-[#5b6478]">
      {siege && <p>{seller.name} · {siege}</p>}
      <p>Document émis par {platform.name} ({[platform.phone, platform.email].filter(Boolean).join(" · ")}) pour le compte du loueur. Montants en francs CFA (XOF).</p>
    </div>
  );
}

/** « Lu et approuvé » : acceptation en ligne par le client, à la place de la signature manuscrite. */
export function AcceptanceBox({ buyerName, acceptedAt, pendingLabel }: { buyerName: string; acceptedAt?: string | Date | null; pendingLabel?: string }) {
  if (!acceptedAt && !pendingLabel) return null;
  return (
    <div className="ml-auto mt-6 w-full max-w-[85mm] rounded-[8px] border border-[#dfe3ec] p-3 [break-inside:avoid]">
      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#5b6478]">Le client</p>
      {acceptedAt ? (
        <>
          <p className="mt-1 font-semibold text-[#0f1b3d]">« Lu et approuvé »</p>
          <p>Accepté en ligne par {buyerName} le {formatDateTime(acceptedAt)}.</p>
        </>
      ) : (
        <p className="mt-1 text-[#5b6478]">{pendingLabel}</p>
      )}
    </div>
  );
}

/** Conditions générales du loueur, en page suivante à l'impression. */
export function TermsSection({ sellerName, terms, date }: { sellerName: string; terms: string; date?: Date | string }) {
  return (
    <section className="mt-8 border-t border-[#dfe3ec] pt-5 print:mt-0 print:border-0 print:pt-0 print:[break-before:page]">
      <h2 className="text-[13px] font-bold uppercase tracking-wide text-[#0f1b3d]">Conditions générales de {sellerName}</h2>
      {date && <p className="text-[10px] text-[#5b6478]">En vigueur au {formatDate(date)}</p>}
      <div className="mt-2 whitespace-pre-line text-[11px] leading-relaxed">{terms}</div>
    </section>
  );
}
