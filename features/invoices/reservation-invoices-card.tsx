import Link from "next/link";
import type { Actor } from "@/lib/auth/actor";
import { formatDate } from "@/lib/dates";
import { formatFcfa } from "@/lib/money";
import { INVOICE_TITLE, canSeeInvoices, reservationInvoices } from "@/services/invoices";
import { Card } from "@/components/ui/card";
import { Receipt } from "@/components/ui/icons";

/** Bloc « Factures » des pages de réservation : documents visibles par l'acteur et lien vers le récapitulatif imprimable. */
export async function ReservationInvoicesCard({ actor, reservationId }: { actor: Actor; reservationId: string }) {
  if (!canSeeInvoices(actor)) return null;
  const invoices = await reservationInvoices(actor, reservationId);
  return (
    <Card className="p-5">
      <h2 className="flex items-center gap-2 text-base font-semibold text-ink"><Receipt size={18} className="text-royal-ink" /> Factures</h2>
      {invoices.length === 0 ? (
        <p className="mt-2 text-sm text-muted">Les factures sont émises dès la confirmation du paiement.</p>
      ) : (
        <ul className="mt-3 space-y-2.5 text-sm">
          {invoices.map((i) => (
            <li key={i.id} className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link href={`/factures/${i.id}`} className="font-medium text-royal-ink hover:underline">{INVOICE_TITLE[i.kind]}</Link>
                <p className="text-xs text-muted"><span className="font-mono">{i.number}</span> · {formatDate(i.issuedAt)}{actor.accountType !== "LENDER" ? ` · ${i.lender.companyName}` : ""}</p>
              </div>
              <span className="shrink-0 tabular-nums text-ink">{i.kind === "CREDIT_NOTE" ? "- " : ""}{formatFcfa(i.totalTtc)}</span>
            </li>
          ))}
        </ul>
      )}
      {invoices.length > 0 && <Link href={`/factures/commande/${reservationId}`} className="mt-4 inline-block text-sm font-medium text-royal-ink hover:underline">Récapitulatif imprimable</Link>}
    </Card>
  );
}
