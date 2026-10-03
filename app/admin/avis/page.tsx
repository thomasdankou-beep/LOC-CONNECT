import type { Metadata } from "next";
import { pageAdmin } from "@/lib/auth/page";
import { formatDate } from "@/lib/dates";
import { listReviews } from "@/services/admin";
import { PageHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Stars } from "@/components/ui/misc";
import { Pagination } from "@/components/ui/pagination";
import { FilterBar } from "@/components/ui/filter-bar";
import { ReviewActions } from "@/features/admin/moderation-actions";

export const metadata: Metadata = { title: "Avis", robots: { index: false } };

const STATUS = { PUBLISHED: { label: "Publié", tone: "success" }, PENDING: { label: "En attente", tone: "warning" }, HIDDEN: { label: "Masqué", tone: "danger" } } as const;

export default async function Page({ searchParams }: { searchParams: Promise<{ status?: string; page?: string }> }) {
  const actor = await pageAdmin("ADMIN_REVIEWS");
  const sp = await searchParams;
  const r = await listReviews(actor, { status: sp.status, page: Number(sp.page) || 1 });
  return (
    <>
      <PageHeader title="Avis" description="Modération des avis clients. Un avis masqué n'entre plus dans les notes affichées." />
      <FilterBar basePath="/admin/avis" status={sp.status} statuses={Object.entries(STATUS).map(([value, e]) => ({ value, label: e.label }))} placeholder="Statut" />
      <DataTable
        rows={r.rows}
        rowKey={(v) => v.id}
        empty={{ title: "Aucun avis", description: "Aucun avis pour ce filtre." }}
        columns={[
          { header: "Client", cell: (v) => `${v.client.firstName} ${v.client.lastName.slice(0, 1)}.` },
          { header: "Produit", cell: (v) => <span className="block"><span className="block max-w-48 truncate font-medium text-ink">{v.product.name}</span><span className="block text-xs text-muted">{v.lender.companyName}</span></span> },
          { header: "Note", cell: (v) => <Stars value={(v.productRating + v.lenderRating + v.experienceRating) / 3} /> },
          { header: "Commentaire", cell: (v) => <span className="block max-w-72 text-sm text-muted">{v.comment ?? ""}</span> },
          { header: "Date", cell: (v) => formatDate(v.createdAt) },
          { header: "Statut", cell: (v) => <Badge tone={STATUS[v.status].tone}>{STATUS[v.status].label}</Badge> },
          { header: "Action", cell: (v) => <ReviewActions id={v.id} status={v.status} /> },
        ]}
      />
      <Pagination page={r.page} totalPages={r.totalPages} basePath="/admin/avis" params={{ status: sp.status }} />
    </>
  );
}
