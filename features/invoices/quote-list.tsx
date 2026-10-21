import Link from "next/link";
import type { Actor } from "@/lib/auth/actor";
import { formatDate } from "@/lib/dates";
import { formatFcfa } from "@/lib/money";
import { listQuotes, QUOTE_STATUS } from "@/services/quotes";
import { DataTable } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/badge";

/** Proformas du client : demandées depuis la page de commande, payables tant qu'elles sont valables. */
export async function QuoteList({ actor }: { actor: Actor }) {
  const rows = await listQuotes(actor, { take: 20 });
  if (rows.length === 0) return null;
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-lg font-semibold text-ink">Proformas</h2>
      <DataTable
        rows={rows}
        rowKey={(q) => q.id}
        empty={{ title: "Aucune proforma" }}
        columns={[
          { header: "N°", cell: (q) => <Link href={`/proformas/${q.id}`} className="font-mono text-[13px] font-medium text-royal-ink hover:underline">{q.number}</Link> },
          { header: "État", cell: (q) => <StatusBadge entry={QUOTE_STATUS[q.status]} /> },
          { header: "Date", cell: (q) => formatDate(q.createdAt) },
          { header: "Valable jusqu'au", cell: (q) => formatDate(q.validUntil) },
          { header: "Net à payer", align: "right" as const, cell: (q) => <span className="tabular-nums">{formatFcfa(q.netToPay)}</span> },
          { header: "", cell: (q) => <Link href={`/proformas/${q.id}`} className="text-sm font-medium text-royal-ink hover:underline">{q.status === "OPEN" ? "Voir et payer" : "Voir et imprimer"}</Link> },
        ]}
      />
    </section>
  );
}
