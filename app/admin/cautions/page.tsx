import type { Metadata } from "next";
import Link from "next/link";
import { pageAdmin } from "@/lib/auth/page";
import { formatFcfa } from "@/lib/money";
import { DEPOSIT_STATUS, RETURN_REPORT_STATUS } from "@/lib/labels";
import { listDeposits } from "@/services/admin";
import { PageHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";
import { FilterBar } from "@/components/ui/filter-bar";
import { DepositActions } from "@/features/admin/finance-actions";

export const metadata: Metadata = { title: "Cautions", robots: { index: false } };

export default async function Page({ searchParams }: { searchParams: Promise<{ status?: string; page?: string }> }) {
  const actor = await pageAdmin("ADMIN_DEPOSITS");
  const sp = await searchParams;
  const r = await listDeposits(actor, { status: sp.status, page: Number(sp.page) || 1 });
  return (
    <>
      <PageHeader title="Cautions" description="Une caution par ligne de réservation, jamais mélangée à celle d'un autre loueur." />
      <FilterBar basePath="/admin/cautions" status={sp.status} statuses={Object.entries(DEPOSIT_STATUS).map(([value, e]) => ({ value, label: e.label }))} placeholder="Statut" />
      <DataTable
        rows={r.rows}
        rowKey={(d) => d.id}
        empty={{ title: "Aucune caution", description: "Aucune caution pour ce filtre." }}
        columns={[
          { header: "Réservation", cell: (d) => <Link href={`/admin/reservations/${d.item.reservation.id}`} className="font-mono text-[13px] text-royal-ink hover:underline">{d.item.reservation.reference}</Link> },
          { header: "Produit", cell: (d) => <span className="block"><span className="block max-w-48 truncate text-ink">{d.item.productName}</span><span className="block text-xs text-muted">{d.item.lender.companyName}</span></span> },
          { header: "Caution", align: "right", cell: (d) => formatFcfa(d.amount) },
          { header: "Retenu", align: "right", cell: (d) => (d.withheldAmount ? formatFcfa(d.withheldAmount) : "") },
          { header: "Restitué", align: "right", cell: (d) => (d.releasedAmount ? formatFcfa(d.releasedAmount) : "") },
          { header: "Constat", cell: (d) => (d.item.returnReport ? <StatusBadge entry={RETURN_REPORT_STATUS[d.item.returnReport.status]} /> : "") },
          { header: "Statut", cell: (d) => <div className="flex flex-wrap items-center gap-1.5"><StatusBadge entry={DEPOSIT_STATUS[d.status]} />{d.frozen && <Badge tone="danger">Gelée</Badge>}</div> },
          { header: "Actions", cell: (d) => (d.status === "HELD" && d.item.returnReport && !d.settledAt ? <DepositActions id={d.id} amount={d.amount} /> : "") },
        ]}
      />
      <Pagination page={r.page} totalPages={r.totalPages} basePath="/admin/cautions" params={{ status: sp.status }} />
    </>
  );
}
