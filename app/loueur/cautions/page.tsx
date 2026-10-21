import type { Metadata } from "next";
import Link from "next/link";
import { pageLender } from "@/lib/auth/page";
import { formatDate } from "@/lib/dates";
import { formatFcfa } from "@/lib/money";
import { DEPOSIT_STATUS } from "@/lib/labels";
import { db } from "@/lib/db";
import { listLenderDeposits } from "@/services/returns";
import { PageHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { KpiCard } from "@/components/ui/misc";
import { Pagination } from "@/components/ui/pagination";
import { FilterBar } from "@/components/ui/filter-bar";
import { ShieldCheck } from "@/components/ui/icons";

export const metadata: Metadata = { title: "Cautions", robots: { index: false } };

export default async function Page({ searchParams }: { searchParams: Promise<{ status?: string; page?: string }> }) {
  const actor = await pageLender("DEPOSIT_VIEW");
  const sp = await searchParams;
  const [result, held, withheld] = await Promise.all([
    listLenderDeposits(actor.lenderId, { status: sp.status, page: Number(sp.page) || 1 }),
    db.deposit.aggregate({ where: { status: "HELD", item: { lenderId: actor.lenderId } }, _sum: { amount: true } }),
    db.deposit.aggregate({ where: { item: { lenderId: actor.lenderId } }, _sum: { withheldAmount: true } }),
  ]);
  return (
    <>
      <PageHeader title="Cautions" description="Une caution par ligne de réservation. Elle est bloquée au paiement et réglée au constat de retour." />
      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <KpiCard label="Cautions actuellement bloquées" value={formatFcfa(held._sum.amount ?? 0)} icon={<ShieldCheck size={20} />} hint="Restituées au client si le matériel revient en bon état" />
        <KpiCard label="Total retenu à votre profit" value={formatFcfa(withheld._sum.withheldAmount ?? 0)} hint="Retenues validées au constat de retour" />
      </div>
      <FilterBar basePath="/loueur/cautions" status={sp.status} statuses={Object.entries(DEPOSIT_STATUS).map(([value, e]) => ({ value, label: e.label }))} placeholder="Statut" />
      <DataTable
        rows={result.rows}
        rowKey={(d) => d.id}
        empty={{ title: "Aucune caution", description: "Les cautions des réservations payées apparaissent ici." }}
        columns={[
          { header: "Réservation", cell: (d) => <Link href={`/loueur/reservations/${d.item.reservation.id}`} className="font-mono text-[13px] font-medium text-royal-ink hover:underline">{d.item.reservation.reference}</Link> },
          { header: "Produit", cell: (d) => <span className="block max-w-56 truncate">{d.item.quantity} x {d.item.productName}</span> },
          { header: "Fin de location", cell: (d) => formatDate(d.item.endDate) },
          { header: "Caution", align: "right", cell: (d) => formatFcfa(d.amount) },
          { header: "Retenu", align: "right", cell: (d) => (d.withheldAmount > 0 ? formatFcfa(d.withheldAmount) : "") },
          { header: "Restitué", align: "right", cell: (d) => (d.releasedAmount > 0 ? formatFcfa(d.releasedAmount) : "") },
          { header: "Statut", cell: (d) => <div className="flex flex-wrap items-center gap-1.5"><StatusBadge entry={DEPOSIT_STATUS[d.status]} />{d.frozen && <Badge tone="danger">Gelée</Badge>}</div> },
        ]}
      />
      <Pagination page={result.page} totalPages={result.totalPages} basePath="/loueur/cautions" params={{ status: sp.status }} />
    </>
  );
}
