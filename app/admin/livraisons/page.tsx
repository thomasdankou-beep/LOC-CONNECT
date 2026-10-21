import type { Metadata } from "next";
import Link from "next/link";
import type { DeliveryStatus } from "@prisma/client";
import { pageAdmin } from "@/lib/auth/page";
import { formatDate } from "@/lib/dates";
import { formatFcfa } from "@/lib/money";
import { DELIVERY_STATUS } from "@/lib/labels";
import { listAdminDeliveries } from "@/services/deliveries";
import { PageHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";
import { FilterBar } from "@/components/ui/filter-bar";

export const metadata: Metadata = { title: "Livraisons", robots: { index: false } };

export default async function Page({ searchParams }: { searchParams: Promise<{ status?: string; page?: string }> }) {
  await pageAdmin("ADMIN_DELIVERIES");
  const sp = await searchParams;
  const r = await listAdminDeliveries(Number(sp.page) || 1, 20, (sp.status as DeliveryStatus | undefined) || undefined);
  return (
    <>
      <PageHeader title="Livraisons" description="Suivi des livraisons assurées par les loueurs. Une livraison par loueur et par commande." />
      <FilterBar basePath="/admin/livraisons" status={sp.status} statuses={Object.entries(DELIVERY_STATUS).map(([value, e]) => ({ value, label: e.label }))} placeholder="Statut" />
      <DataTable
        rows={r.rows}
        rowKey={(d) => d.id}
        empty={{ title: "Aucune livraison", description: "Aucune livraison pour ce filtre." }}
        columns={[
          { header: "Réservation", cell: (d) => <Link href={`/admin/reservations/${d.reservation.id}`} className="font-mono text-[13px] text-royal-ink hover:underline">{d.reservation.reference}</Link> },
          { header: "Loueur", cell: (d) => d.lender.companyName },
          { header: "Mode", cell: (d) => (d.type === "DELIVERY" ? "Livraison" : "Retrait") },
          { header: "Adresse", cell: (d) => <span className="block max-w-56 truncate">{d.address ?? ""}</span> },
          { header: "Prévue le", cell: (d) => (d.scheduledDate ? formatDate(d.scheduledDate) : "À planifier") },
          { header: "Frais", align: "right", cell: (d) => formatFcfa(d.fee) },
          { header: "Statut", cell: (d) => <StatusBadge entry={DELIVERY_STATUS[d.status]} /> },
        ]}
      />
      <Pagination page={r.page} totalPages={r.totalPages} basePath="/admin/livraisons" params={{ status: sp.status }} />
    </>
  );
}
