import type { Metadata } from "next";
import Link from "next/link";
import { requireClient } from "@/lib/auth/actor";
import { formatDate } from "@/lib/dates";
import { formatFcfa } from "@/lib/money";
import { REFUND_STATUS } from "@/lib/labels";
import { listClientRefunds } from "@/services/refunds";
import { PageHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Mes remboursements", robots: { index: false } };

const KIND = { CANCELLATION: "Annulation", MODIFICATION: "Modification", DEPOSIT_RELEASE: "Restitution de caution", DISPUTE: "Litige", GOODWILL: "Geste commercial" } as const;

export default async function Page() {
  const actor = await requireClient();
  const rows = await listClientRefunds(actor.userId);
  return (
    <>
      <PageHeader title="Mes remboursements" description="Annulations, cautions restituées, modifications et décisions de litige." />
      <DataTable
        rows={rows}
        rowKey={(r) => r.id}
        empty={{ title: "Aucun remboursement", description: "Aucun remboursement n'a été effectué sur vos réservations." }}
        columns={[
          { header: "Date", cell: (r) => formatDate(r.createdAt) },
          { header: "Référence", cell: (r) => <span className="font-mono text-sm">{r.reference}</span> },
          { header: "Réservation", cell: (r) => <Link href={`/mes-reservations/${r.reservation.id}`} className="font-mono text-royal-ink hover:underline">{r.reservation.reference}</Link> },
          { header: "Nature", cell: (r) => KIND[r.kind] },
          { header: "Motif", cell: (r) => <span className="line-clamp-1 max-w-xs">{r.reason}</span> },
          { header: "Montant", align: "right", cell: (r) => formatFcfa(r.amount) },
          { header: "Statut", cell: (r) => <StatusBadge entry={REFUND_STATUS[r.status]} /> },
        ]}
      />
    </>
  );
}
