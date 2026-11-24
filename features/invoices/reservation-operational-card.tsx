import Link from "next/link";
import type { Actor } from "@/lib/auth/actor";
import { Card } from "@/components/ui/card";
import { FileText } from "@/components/ui/icons";
import type { ReservationDetail } from "@/services/reservations";
import { operationalDocuments } from "./operational-documents";

export function ReservationOperationalCard({ actor, reservation }: { actor: Actor; reservation: ReservationDetail }) {
  const lenders = [...new Map(reservation.items.map((item) => [item.lenderId, item.lender.companyName]))];
  const groups = lenders.flatMap(([id, name]) => {
    const documents = operationalDocuments(actor, reservation, id);
    return documents ? [{ id, name, titles: documents.titles }] : [];
  });
  const quoteId = actor.accountType === "LENDER" ? null : reservation.quoteId;
  if (!groups.length && !quoteId) return null;

  return (
    <Card className="p-5">
      <h2 className="flex items-center gap-2 font-semibold text-ink"><FileText size={18} className="text-royal-ink" aria-hidden /> Documents de la réservation</h2>
      {quoteId && (
        <Link href={`/proformas/${quoteId}`} className="mt-3 inline-block text-sm font-medium text-royal-ink hover:underline">Consulter la proforma</Link>
      )}
      {groups.map(({ id, name, titles }) => (
        <div key={id} className="mt-4 border-t border-line pt-3">
          <h3 className="text-sm font-medium text-ink">{name}</h3>
          <ul className="mt-2 space-y-2 text-sm">
            {Object.entries(titles).map(([kind, title]) => (
              <li key={kind}><Link href={`/bons/${reservation.id}/${id}/${kind}`} className="font-medium text-royal-ink hover:underline">{title}</Link></li>
            ))}
          </ul>
        </div>
      ))}
    </Card>
  );
}
