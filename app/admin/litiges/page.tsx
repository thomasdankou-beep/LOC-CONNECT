import type { Metadata } from "next";
import Link from "next/link";
import type { DisputeStatus } from "@prisma/client";
import { pageAdmin } from "@/lib/auth/page";
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
  const actor = await pageAdmin("ADMIN_DISPUTES");
  const sp = await searchParams;
  const r = await listDisputes(actor, { status: sp.status as DisputeStatus | undefined, page: Number(sp.page) || 1 });
  return (
    <>
      <PageHeader title="Litiges" description="Chaque litige vise un seul loueur. Les autres lignes de la commande ne sont pas affectées." />
      <FilterBar basePath="/admin/litiges" status={sp.status} statuses={Object.entries(DISPUTE_STATUS).map(([value, e]) => ({ value, label: e.label }))} placeholder="Statut" />
      <DataTable
        rows={r.rows}
        rowKey={(d) => d.id}
        empty={{ title: "Aucun litige", description: "Aucun litige pour ce filtre." }}
        columns={[
          { header: "Référence", cell: (d) => <Link href={`/admin/litiges/${d.id}`} className="font-mono font-medium text-royal-ink hover:underline">{d.reference}</Link> },
          { header: "Réservation", cell: (d) => <span className="font-mono text-[13px]">{d.reservation.reference}</span> },
          { header: "Loueur visé", cell: (d) => d.lender?.companyName ?? "" },
          { header: "Motif", cell: (d) => <span className="block max-w-56 truncate">{d.reason}</span> },
          { header: "Montant", align: "right", cell: (d) => formatFcfa(d.disputedAmount) },
          { header: "Ouvert le", cell: (d) => formatDate(d.createdAt) },
          { header: "Statut", cell: (d) => <StatusBadge entry={DISPUTE_STATUS[d.status]} /> },
        ]}
      />
      <Pagination page={r.page} totalPages={r.totalPages} basePath="/admin/litiges" params={{ status: sp.status }} />
    </>
  );
}
