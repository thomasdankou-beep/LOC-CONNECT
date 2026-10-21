import type { Metadata } from "next";
import Link from "next/link";
import type { DisputeStatus } from "@prisma/client";
import { pageLender } from "@/lib/auth/page";
import { formatDate } from "@/lib/dates";
import { formatFcfa } from "@/lib/money";
import { DISPUTE_STATUS } from "@/lib/labels";
import { listDisputes } from "@/services/disputes";
import { PageHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";
import { FilterBar } from "@/components/ui/filter-bar";

export const metadata: Metadata = { title: "Litiges", robots: { index: false } };

export default async function Page({ searchParams }: { searchParams: Promise<{ status?: string; page?: string }> }) {
  const actor = await pageLender("DISPUTE_VIEW");
  const sp = await searchParams;
  const result = await listDisputes(actor, { status: sp.status as DisputeStatus | undefined, page: Number(sp.page) || 1 });
  return (
    <>
      <PageHeader title="Litiges" description="Seuls les litiges qui vous visent apparaissent ici. Répondez avec des preuves : l'administration arbitre." />
      <FilterBar basePath="/loueur/litiges" status={sp.status} statuses={Object.entries(DISPUTE_STATUS).map(([value, e]) => ({ value, label: e.label }))} placeholder="Statut" />
      <DataTable
        rows={result.rows}
        rowKey={(d) => d.id}
        empty={{ title: "Aucun litige", description: "Aucun client n'a ouvert de litige à votre encontre." }}
        columns={[
          { header: "Référence", cell: (d) => <Link href={`/loueur/litiges/${d.id}`} className="font-mono font-medium text-royal-ink hover:underline">{d.reference}</Link> },
          { header: "Réservation", cell: (d) => <span className="font-mono text-[13px]">{d.reservation.reference}</span> },
          { header: "Motif", cell: (d) => <span className="block max-w-64 truncate">{d.reason}</span> },
          { header: "Montant", align: "right", cell: (d) => formatFcfa(d.disputedAmount) },
          { header: "Ouvert le", cell: (d) => formatDate(d.createdAt) },
          { header: "Statut", cell: (d) => <StatusBadge entry={DISPUTE_STATUS[d.status]} /> },
        ]}
      />
      <Pagination page={result.page} totalPages={result.totalPages} basePath="/loueur/litiges" params={{ status: sp.status }} />
    </>
  );
}
