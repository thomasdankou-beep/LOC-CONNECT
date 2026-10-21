import type { Metadata } from "next";
import Link from "next/link";
import { pageLender } from "@/lib/auth/page";
import { formatDateTime } from "@/lib/dates";
import { formatFcfa } from "@/lib/money";
import { BALANCE_KIND } from "@/lib/labels";
import { lenderBalance, lenderRevenueByMonth, listBalanceEntries } from "@/services/payouts";
import { Card, CardHeader, PageHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { KpiCard } from "@/components/ui/misc";
import { Pagination } from "@/components/ui/pagination";
import { BarChart } from "@/components/charts/bar-chart";
import { Bank, ChartLineUp, ClockCountdown, Scales } from "@/components/ui/icons";

export const metadata: Metadata = { title: "Revenus", robots: { index: false } };

const MONTH = new Intl.DateTimeFormat("fr-FR", { month: "short", timeZone: "UTC" });

export default async function Page({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const actor = await pageLender("FINANCE_VIEW");
  const sp = await searchParams;
  const [balance, revenue, entries] = await Promise.all([lenderBalance(actor.lenderId), lenderRevenueByMonth(actor.lenderId, 12), listBalanceEntries(actor.lenderId, { page: Number(sp.page) || 1 })]);
  const chart = revenue.map((r) => ({ label: MONTH.format(new Date(`${r.month}-01T00:00:00Z`)), values: { net: r.net, commission: r.commission } }));
  const totalNet = revenue.reduce((a, r) => a + r.net, 0);
  const totalGross = revenue.reduce((a, r) => a + r.gross, 0);
  const totalCommission = revenue.reduce((a, r) => a + r.commission, 0);
  const now = new Date();

  return (
    <>
      <PageHeader title="Revenus" description="Ventes, commission et état de chaque montant sur douze mois." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard primary label="Part nette sur 12 mois" value={formatFcfa(totalNet)} icon={<ChartLineUp size={20} />} hint={`${formatFcfa(totalGross)} de ventes brutes`} />
        <KpiCard label="Commission LOC'CONNECT" value={formatFcfa(totalCommission)} icon={<Scales size={20} />} hint="Prélevée sur les locations" />
        <KpiCard label="Gelé ou bloqué" value={formatFcfa(balance.frozen + balance.blocked)} icon={<ClockCountdown size={20} />} hint="Fin de contestation ou litige en cours" />
        <KpiCard label="Disponible au versement" value={formatFcfa(balance.payable)} icon={<Bank size={20} />} hint={balance.owed > 0 ? `après ${formatFcfa(balance.owed)} de déductions` : "Aucune déduction"} />
      </div>

      <Card className="mt-6">
        <CardHeader title="Évolution mensuelle" description="Part nette du loueur et commission" />
        <div className="p-5">
          {chart.length === 0 ? <p className="py-10 text-center text-sm text-muted">Pas encore de revenus.</p> : <BarChart data={chart} series={[{ key: "net", label: "Part loueur" }, { key: "commission", label: "Commission" }]} unit="fcfa" ariaLabel="Revenus mensuels du loueur sur douze mois" />}
        </div>
      </Card>

      <h2 className="mb-3 mt-8 text-lg font-semibold text-ink">Journal des mouvements</h2>
      <DataTable
        rows={entries.rows}
        rowKey={(e) => e.id}
        empty={{ title: "Aucun mouvement", description: "Chaque vente, retenue ou déduction apparaît ici." }}
        columns={[
          { header: "Date", cell: (e) => <span className="whitespace-nowrap">{formatDateTime(e.createdAt)}</span> },
          { header: "Nature", cell: (e) => BALANCE_KIND[e.kind] },
          { header: "Détail", cell: (e) => (e.item ? <Link href={`/loueur/reservations/${e.item.reservation.id}`} className="text-royal-ink hover:underline"><span className="font-mono text-[13px]">{e.item.reservation.reference}</span> · {e.item.productName}</Link> : (e.note ?? "")) },
          { header: "Montant", align: "right", cell: (e) => <span className={e.amount < 0 ? "text-danger" : ""}>{e.amount < 0 ? "- " : ""}{formatFcfa(Math.abs(e.amount))}</span> },
          { header: "État", cell: (e) => (e.payoutId ? <Badge tone="success">Versé</Badge> : e.amount < 0 ? <Badge tone="danger">À compenser</Badge> : e.blocked ? <Badge tone="danger">Bloqué</Badge> : e.availableAt > now ? <Badge tone="warning">Gelé jusqu&apos;au {e.availableAt.toLocaleDateString("fr-FR", { timeZone: "UTC" })}</Badge> : <Badge tone="info">Disponible</Badge>) },
        ]}
      />
      <Pagination page={entries.page} totalPages={entries.totalPages} basePath="/loueur/revenus" />
    </>
  );
}
