import type { Metadata } from "next";
import { pageAdmin } from "@/lib/auth/page";
import { formatDateTime } from "@/lib/dates";
import { listStockMovements } from "@/services/admin";
import { PageHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";

export const metadata: Metadata = { title: "Stocks", robots: { index: false } };

const REASONS: Record<string, string> = { PURCHASE: "Achat", REPAIR: "Réparation", LOSS: "Perte", CORRECTION: "Correction", RETURN_TO_STOCK: "Retour en stock", INITIAL: "Stock initial", RETURN_LOSS: "Perte au retour" };

export default async function Page({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const actor = await pageAdmin("ADMIN_STOCK");
  const sp = await searchParams;
  const r = await listStockMovements(actor, { page: Number(sp.page) || 1 });
  return (
    <>
      <PageHeader title="Mouvements de stock" description="Journal des ajustements de stock de tous les loueurs, pour détecter les écarts." />
      <DataTable
        rows={r.rows}
        rowKey={(m) => m.id}
        empty={{ title: "Aucun mouvement", description: "Les ajustements de stock apparaissent ici." }}
        columns={[
          { header: "Date", cell: (m) => <span className="whitespace-nowrap">{formatDateTime(m.createdAt)}</span> },
          { header: "Produit", cell: (m) => <span className="block"><span className="block max-w-56 truncate font-medium text-ink">{m.product.name}</span><span className="block text-xs text-muted">{m.product.lender.companyName}</span></span> },
          { header: "Motif", cell: (m) => REASONS[m.reason] ?? m.reason },
          { header: "Note", cell: (m) => <span className="block max-w-56 truncate text-muted">{m.note ?? ""}</span> },
          { header: "Avant", align: "right", cell: (m) => m.previousQty },
          { header: "Variation", align: "right", cell: (m) => <span className={m.delta > 0 ? "text-success" : "text-danger"}>{m.delta > 0 ? "+" : ""}{m.delta}</span> },
          { header: "Après", align: "right", cell: (m) => m.newQty },
        ]}
      />
      <Pagination page={r.page} totalPages={r.totalPages} basePath="/admin/stock" />
    </>
  );
}
