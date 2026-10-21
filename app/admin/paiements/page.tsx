import type { Metadata } from "next";
import Link from "next/link";
import { pageAdmin } from "@/lib/auth/page";
import { formatDateTime } from "@/lib/dates";
import { formatFcfa, sum } from "@/lib/money";
import { PAYMENT_METHOD, PAYMENT_STATUS } from "@/lib/labels";
import { listPayments } from "@/services/admin";
import { PageHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";
import { FilterBar } from "@/components/ui/filter-bar";
import { Notice } from "@/components/ui/states";

export const metadata: Metadata = { title: "Paiements", robots: { index: false } };

export default async function Page({ searchParams }: { searchParams: Promise<{ status?: string; page?: string }> }) {
  const actor = await pageAdmin("ADMIN_PAYMENTS");
  const sp = await searchParams;
  const r = await listPayments(actor, { status: sp.status, page: Number(sp.page) || 1 });
  const simulated = r.rows.some((p) => p.provider === "simulated");
  return (
    <>
      <PageHeader title="Paiements" description="Paiements initiaux, compléments de modification et compléments de dommages, confirmés par webhook signé." />
      {simulated && <div className="mb-5"><Notice tone="warning" title="Fournisseur de paiement simulé">Aucun fonds réel n&apos;est déplacé. Le fournisseur se change dans la configuration (variable PAYMENT_PROVIDER) sans toucher au reste de la plateforme.</Notice></div>}
      <FilterBar basePath="/admin/paiements" status={sp.status} statuses={Object.entries(PAYMENT_STATUS).map(([value, e]) => ({ value, label: e.label }))} placeholder="Statut" />
      <DataTable
        rows={r.rows}
        rowKey={(p) => p.id}
        empty={{ title: "Aucun paiement", description: "Aucun paiement pour ce filtre." }}
        columns={[
          { header: "Référence", cell: (p) => <span className="font-mono text-[13px]">{p.reference}</span> },
          { header: "Réservation", cell: (p) => <Link href={`/admin/reservations/${p.reservation.id}`} className="font-mono text-[13px] text-royal-ink hover:underline">{p.reservation.reference}</Link> },
          { header: "Client", cell: (p) => `${p.user.firstName} ${p.user.lastName}` },
          { header: "Moyen", cell: (p) => <span className="whitespace-nowrap">{PAYMENT_METHOD[p.method]} {p.provider === "simulated" && <Badge tone="warning">Simulé</Badge>}</span> },
          { header: "Montant", align: "right", cell: (p) => formatFcfa(p.amount) },
          { header: "Commission", align: "right", cell: (p) => (p.allocations.length ? formatFcfa(sum(p.allocations.map((a) => a.commissionAmount))) : "") },
          { header: "Date", cell: (p) => formatDateTime(p.paidAt ?? p.createdAt) },
          { header: "Statut", cell: (p) => <StatusBadge entry={PAYMENT_STATUS[p.status]} /> },
        ]}
      />
      <Pagination page={r.page} totalPages={r.totalPages} basePath="/admin/paiements" params={{ status: sp.status }} />
    </>
  );
}
