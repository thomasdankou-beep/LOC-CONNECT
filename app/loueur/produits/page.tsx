import type { Metadata } from "next";
import { getSettings } from "@/lib/settings";
import { depositFloorFrom, depositLabel, depositPercentFrom } from "@/services/pricing";
import Link from "next/link";
import { can } from "@/lib/auth/actor";
import { pageLender } from "@/lib/auth/page";
import { formatFcfa } from "@/lib/money";
import { PRODUCT_STATUS } from "@/lib/labels";
import { listLenderProducts } from "@/services/products";
import { PageHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { Photo } from "@/components/ui/photo";
import { Plus } from "@/components/ui/icons";
import { FilterBar } from "@/components/ui/filter-bar";
import type { ProductStatus } from "@prisma/client";

export const metadata: Metadata = { title: "Mes produits", robots: { index: false } };

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; page?: string }> }) {
  const actor = await pageLender("PRODUCT_VIEW");
  const sp = await searchParams;
  const settings = await getSettings();
  const depositPercent = depositPercentFrom(settings);
  const depositFloor = depositFloorFrom(settings);
  const result = await listLenderProducts(actor.lenderId, { q: sp.q, status: sp.status as ProductStatus | undefined, page: Number(sp.page) || 1 });
  return (
    <>
      <PageHeader title="Mes produits" description="Créez, modifiez et publiez vos équipements. Les produits publiés passent par la modération de LOC'CONNECT." actions={can(actor, "PRODUCT_CREATE") && <LinkButton href="/loueur/produits/nouveau"><Plus size={18} /> Nouveau produit</LinkButton>} />
      <FilterBar basePath="/loueur/produits" q={sp.q} status={sp.status} statuses={Object.entries(PRODUCT_STATUS).map(([value, e]) => ({ value, label: e.label }))} placeholder="Rechercher un produit" />
      <DataTable
        rows={result.rows}
        rowKey={(p) => p.id}
        empty={{ title: "Aucun produit", description: "Publiez votre premier produit pour recevoir des réservations.", action: can(actor, "PRODUCT_CREATE") ? <LinkButton href="/loueur/produits/nouveau">Créer un produit</LinkButton> : undefined }}
        columns={[
          { header: "Produit", cell: (p) => (
            <Link href={`/loueur/produits/${p.id}`} className="flex items-center gap-3">
              <Photo src={p.photos[0]?.url} alt="" w={96} h={72} className="size-12 shrink-0 rounded-control" />
              <span className="min-w-0"><span className="block truncate font-medium text-ink hover:underline">{p.name}</span><span className="block text-xs text-muted">{p.category.name} · {p.city.name}</span></span>
            </Link>
          ) },
          { header: "Prix / jour", align: "right", cell: (p) => formatFcfa(p.unitPrice) },
          { header: "Caution", align: "right", cell: (p) => depositLabel(depositPercent, depositFloor, p.refundPrice) ?? formatFcfa(p.depositAmount) },
          { header: "Stock", align: "right", cell: (p) => p.stockQuantity },
          { header: "Statut", cell: (p) => <div><StatusBadge entry={PRODUCT_STATUS[p.status]} />{p.status === "REJECTED" && p.rejectionReason && <p className="mt-1 max-w-48 text-xs text-danger">{p.rejectionReason}</p>}</div> },
        ]}
      />
      <Pagination page={result.page} totalPages={result.totalPages} basePath="/loueur/produits" params={{ q: sp.q, status: sp.status }} />
    </>
  );
}
