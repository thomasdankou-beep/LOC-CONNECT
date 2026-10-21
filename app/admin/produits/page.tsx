import type { Metadata } from "next";
import { getSettings } from "@/lib/settings";
import { depositFloorFrom, depositLabel, depositPercentFrom } from "@/services/pricing";
import Link from "next/link";
import { pageAdmin } from "@/lib/auth/page";
import { formatFcfa } from "@/lib/money";
import { PRODUCT_STATUS } from "@/lib/labels";
import { listProducts } from "@/services/admin";
import { PageHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";
import { FilterBar } from "@/components/ui/filter-bar";
import { Photo } from "@/components/ui/photo";
import { ProductActions } from "@/features/admin/moderation-actions";

export const metadata: Metadata = { title: "Produits", robots: { index: false } };

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; page?: string }> }) {
  const actor = await pageAdmin("ADMIN_PRODUCTS");
  const sp = await searchParams;
  const settings = await getSettings();
  const depositPercent = depositPercentFrom(settings);
  const depositFloor = depositFloorFrom(settings);
  const r = await listProducts(actor, { q: sp.q, status: sp.status, page: Number(sp.page) || 1 });
  return (
    <>
      <PageHeader title="Produits" description="Modération avant publication. Les produits en attente sont listés en premier." />
      <FilterBar basePath="/admin/produits" q={sp.q} status={sp.status} statuses={Object.entries(PRODUCT_STATUS).map(([value, e]) => ({ value, label: e.label }))} placeholder="Nom du produit" />
      <DataTable
        rows={r.rows}
        rowKey={(p) => p.id}
        empty={{ title: "Aucun produit", description: "Aucun produit ne correspond à ces filtres." }}
        columns={[
          { header: "Produit", cell: (p) => (
            <span className="flex items-center gap-3">
              <Photo src={p.photos[0]?.url} alt="" w={96} h={72} className="size-12 shrink-0 rounded-control" />
              <span className="min-w-0"><Link href={`/produits/${p.slug}`} className="block truncate font-medium text-ink hover:underline">{p.name}</Link><span className="block text-xs text-muted">{p.category.name} · {p.city.name}</span></span>
            </span>
          ) },
          { header: "Loueur", cell: (p) => p.lender.companyName },
          { header: "Prix / jour", align: "right", cell: (p) => formatFcfa(p.unitPrice) },
          { header: "Caution", align: "right", cell: (p) => depositLabel(depositPercent, depositFloor, p.refundPrice) ?? formatFcfa(p.depositAmount) },
          { header: "Stock", align: "right", cell: (p) => p.stockQuantity },
          { header: "Statut", cell: (p) => <div><StatusBadge entry={PRODUCT_STATUS[p.status]} />{p.rejectionReason && p.status !== "PUBLISHED" && <p className="mt-1 max-w-48 text-xs text-muted">{p.rejectionReason}</p>}</div> },
          { header: "Actions", cell: (p) => <ProductActions id={p.id} status={p.status} /> },
        ]}
      />
      <Pagination page={r.page} totalPages={r.totalPages} basePath="/admin/produits" params={{ q: sp.q, status: sp.status }} />
    </>
  );
}
