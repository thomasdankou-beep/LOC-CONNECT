import type { Metadata } from "next";
import Link from "next/link";
import { requireClient } from "@/lib/auth/actor";
import { formatDate } from "@/lib/dates";
import { formatFcfa } from "@/lib/money";
import { DISPUTE_STATUS } from "@/lib/labels";
import { listDisputes } from "@/services/disputes";
import { PageHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Mes litiges", robots: { index: false } };

export default async function Page({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const actor = await requireClient();
  const { page } = await searchParams;
  const result = await listDisputes(actor, { page: Number(page) || 1 });
  return (
    <>
      <PageHeader title="Mes litiges" description="Un litige cible un loueur précis. Ouvrez-le depuis le détail d'une réservation." />
      <DataTable
        rows={result.rows}
        rowKey={(d) => d.id}
        empty={{ title: "Aucun litige", description: "Tout se passe bien : vous n'avez ouvert aucun litige." }}
        columns={[
          { header: "Référence", cell: (d) => <Link href={`/mes-litiges/${d.id}`} className="font-mono font-medium text-royal-ink hover:underline">{d.reference}</Link> },
          { header: "Réservation", cell: (d) => <span className="font-mono">{d.reservation.reference}</span> },
          { header: "Loueur", cell: (d) => d.lender?.companyName ?? "" },
          { header: "Motif", cell: (d) => d.reason },
          { header: "Montant", align: "right", cell: (d) => formatFcfa(d.disputedAmount) },
          { header: "Ouvert le", cell: (d) => formatDate(d.createdAt) },
          { header: "Statut", cell: (d) => <StatusBadge entry={DISPUTE_STATUS[d.status]} /> },
        ]}
      />
    </>
  );
}
