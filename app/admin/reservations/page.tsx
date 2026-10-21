import type { Metadata } from "next";
import Link from "next/link";
import { pageAdmin } from "@/lib/auth/page";
import { formatDate } from "@/lib/dates";
import { formatFcfa } from "@/lib/money";
import { FULFILLMENT, RESERVATION_STATUS } from "@/lib/labels";
import { listReservations } from "@/services/admin";
import { PageHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";
import { FilterBar } from "@/components/ui/filter-bar";

export const metadata: Metadata = { title: "Réservations", robots: { index: false } };

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; page?: string }> }) {
  const actor = await pageAdmin("ADMIN_RESERVATIONS");
  const sp = await searchParams;
  const r = await listReservations(actor, { q: sp.q, status: sp.status, page: Number(sp.page) || 1 });
  return (
    <>
      <PageHeader title="Réservations" description="Toutes les réservations de la plateforme, avec le statut global calculé à partir des lignes." />
      <FilterBar basePath="/admin/reservations" q={sp.q} status={sp.status} statuses={Object.entries(RESERVATION_STATUS).map(([value, e]) => ({ value, label: e.label }))} placeholder="Référence ou nom du client" />
      <DataTable
        rows={r.rows}
        rowKey={(x) => x.id}
        empty={{ title: "Aucune réservation", description: "Aucune réservation ne correspond à ces filtres." }}
        columns={[
          { header: "Référence", cell: (x) => <Link href={`/admin/reservations/${x.id}`} className="font-mono text-[13px] font-medium text-royal-ink hover:underline">{x.reference}</Link> },
          { header: "Client", cell: (x) => `${x.client.firstName} ${x.client.lastName}` },
          { header: "Loueurs", cell: (x) => { const names = [...new Set(x.items.map((i) => i.lender.companyName))]; return <span className="block max-w-56 truncate" title={names.join(", ")}>{names.length > 1 ? `${names.length} loueurs` : names[0]}</span>; } },
          { header: "Mode", cell: (x) => FULFILLMENT[x.fulfillmentType] },
          { header: "Créée le", cell: (x) => formatDate(x.createdAt) },
          { header: "Total", align: "right", cell: (x) => formatFcfa(x.total) },
          { header: "Statut", cell: (x) => <StatusBadge entry={RESERVATION_STATUS[x.status]} /> },
        ]}
      />
      <Pagination page={r.page} totalPages={r.totalPages} basePath="/admin/reservations" params={{ q: sp.q, status: sp.status }} />
    </>
  );
}
