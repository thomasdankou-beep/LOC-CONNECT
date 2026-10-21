import type { Metadata } from "next";
import Link from "next/link";
import { pageAdmin } from "@/lib/auth/page";
import { formatDateTime } from "@/lib/dates";
import { formatFcfa } from "@/lib/money";
import { RETURN_CONDITION, RETURN_REPORT_STATUS } from "@/lib/labels";
import { listReturns } from "@/services/admin";
import { PageHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";

export const metadata: Metadata = { title: "Retours", robots: { index: false } };

export default async function Page({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const actor = await pageAdmin("ADMIN_RETURNS");
  const sp = await searchParams;
  const r = await listReturns(actor, { page: Number(sp.page) || 1 });
  return (
    <>
      <PageHeader title="Constats de retour" description="Constats saisis par les loueurs, avec preuves photo privées et fenêtre de contestation." />
      <DataTable
        rows={r.rows}
        rowKey={(x) => x.id}
        empty={{ title: "Aucun constat", description: "Les constats de retour apparaissent ici." }}
        columns={[
          { header: "Réservation", cell: (x) => <Link href={`/admin/reservations/${x.item.reservation.id}`} className="font-mono text-[13px] text-royal-ink hover:underline">{x.item.reservation.reference}</Link> },
          { header: "Produit", cell: (x) => <span className="block"><span className="block max-w-48 truncate text-ink">{x.item.productName}</span><span className="block text-xs text-muted">{x.item.lender.companyName}</span></span> },
          { header: "État", cell: (x) => RETURN_CONDITION[x.condition] },
          { header: "Retourné / perdu / abîmé", cell: (x) => `${x.returnedQuantity} / ${x.lostQuantity} / ${x.damagedQuantity}` },
          { header: "Retenue", align: "right", cell: (x) => formatFcfa(x.withheldAmount) },
          { header: "Preuves", align: "right", cell: (x) => x.photos.length },
          { header: "Date", cell: (x) => formatDateTime(x.createdAt) },
          { header: "Statut", cell: (x) => <StatusBadge entry={RETURN_REPORT_STATUS[x.status]} /> },
        ]}
      />
      <Pagination page={r.page} totalPages={r.totalPages} basePath="/admin/retours" />
    </>
  );
}
