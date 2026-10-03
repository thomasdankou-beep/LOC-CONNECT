import type { Metadata } from "next";
import { db } from "@/lib/db";
import { pageAdmin } from "@/lib/auth/page";
import { formatDate } from "@/lib/dates";
import { formatFcfa } from "@/lib/money";
import { listPromotions } from "@/services/admin";
import { PageHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PromotionForm, PromotionToggle } from "@/features/admin/finance-actions";

export const metadata: Metadata = { title: "Mises en avant", robots: { index: false } };

export default async function Page() {
  const actor = await pageAdmin("ADMIN_PROMOTIONS");
  const [promos, products] = await Promise.all([listPromotions(actor), db.product.findMany({ where: { status: "PUBLISHED", deletedAt: null }, select: { id: true, name: true, lender: { select: { companyName: true } } }, orderBy: { name: "asc" }, take: 200 })]);
  const now = new Date();
  return (
    <>
      <PageHeader title="Mises en avant" description="Produits mis en avant ou sponsorisés dans le catalogue, pour une durée limitée." actions={<PromotionForm products={products.map((p) => ({ id: p.id, name: `${p.name} (${p.lender.companyName})` }))} />} />
      <DataTable
        rows={promos}
        rowKey={(p) => p.id}
        empty={{ title: "Aucune mise en avant", description: "Mettez un produit en avant pour augmenter sa visibilité." }}
        columns={[
          { header: "Produit", cell: (p) => <span className="block"><span className="block font-medium text-ink">{p.product.name}</span><span className="block text-xs text-muted">{p.product.lender.companyName}</span></span> },
          { header: "Type", cell: (p) => (p.type === "FEATURED" ? "Mis en avant" : "Sponsorisé") },
          { header: "Période", cell: (p) => `${formatDate(p.startsAt)} au ${formatDate(p.endsAt)}` },
          { header: "Montant payé", align: "right", cell: (p) => formatFcfa(p.amountPaid) },
          { header: "Statut", cell: (p) => (p.active && p.endsAt > now ? <Badge tone="success">En cours</Badge> : <Badge>Terminée</Badge>) },
          { header: "Action", cell: (p) => <PromotionToggle id={p.id} active={p.active} /> },
        ]}
      />
    </>
  );
}
