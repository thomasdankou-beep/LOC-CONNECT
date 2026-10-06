import type { Metadata } from "next";
import Link from "next/link";
import type { CashSettlementStatus } from "@prisma/client";
import { pageAdmin } from "@/lib/auth/page";
import { formatDateTime } from "@/lib/dates";
import { formatFcfa } from "@/lib/money";
import { CASH_STATUS } from "@/lib/labels";
import { getSettings } from "@/lib/settings";
import { listCashSettlements } from "@/services/cash";
import { PageHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { KpiCard } from "@/components/ui/misc";
import { Pagination } from "@/components/ui/pagination";
import { FilterBar } from "@/components/ui/filter-bar";
import { AdminCashActions } from "@/features/cash/cash-cards";

export const metadata: Metadata = { title: "Paiements en espèces", robots: { index: false } };

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; page?: string }> }) {
  const actor = await pageAdmin("ADMIN_PAYMENTS");
  const sp = await searchParams;
  const status = sp.status && sp.status in CASH_STATUS ? (sp.status as CashSettlementStatus) : undefined;
  const [r, settings] = await Promise.all([listCashSettlements(actor, { status, q: sp.q || undefined, page: Number(sp.page) || 1 }), getSettings()]);
  const total = (s: CashSettlementStatus) => r.totals.find((t) => t.status === s);
  const max = settings["cash.max_code_attempts"];
  return (
    <>
      <PageHeader title="Paiements en espèces" description="Soldes réglés aux loueurs en espèces à la remise. La commission est déjà encaissée en ligne avec l'acompte : ces montants ne transitent pas par LOC'CONNECT." />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <KpiCard label="À encaisser" value={formatFcfa(total("PENDING")?._sum.amountDue ?? 0)} hint={`${total("PENDING")?._count ?? 0} solde(s) en attente`} />
        <KpiCard label="Confirmés par code" value={formatFcfa(total("PAID")?._sum.amountDue ?? 0)} hint={`${total("PAID")?._count ?? 0} remise(s)`} />
        <KpiCard label="Signalés impayés" value={formatFcfa(total("UNPAID")?._sum.amountDue ?? 0)} hint={`${total("UNPAID")?._count ?? 0} signalement(s) à surveiller`} />
      </div>
      <FilterBar basePath="/admin/especes" q={sp.q} status={sp.status} statuses={Object.entries(CASH_STATUS).map(([value, e]) => ({ value, label: e.label }))} placeholder="Référence ou loueur" />
      <DataTable
        rows={r.rows}
        rowKey={(c) => c.id}
        empty={{ title: "Aucun paiement en espèces", description: "Les soldes des loueurs en mode acompte + espèces apparaissent ici." }}
        columns={[
          { header: "Réservation", cell: (c) => <Link href={`/admin/reservations/${c.reservation.id}`} className="font-mono text-[13px] text-royal-ink hover:underline">{c.reservation.reference}</Link> },
          { header: "Loueur", cell: (c) => c.lender.companyName },
          { header: "Client", cell: (c) => <span className="block">{c.reservation.client.firstName} {c.reservation.client.lastName}{c.reservation.client.phone && <span className="block text-xs text-muted">{c.reservation.client.phone}</span>}</span> },
          { header: "Montant", align: "right", cell: (c) => formatFcfa(c.amountDue) },
          { header: "Statut", cell: (c) => <span className="block"><StatusBadge entry={CASH_STATUS[c.status]} />{c.status === "PENDING" && c.failedAttempts >= max && <Badge tone="danger" className="ml-1">Code bloqué</Badge>}{c.status === "PENDING" && c.failedAttempts > 0 && c.failedAttempts < max && <span className="mt-1 block text-xs text-muted">{c.failedAttempts} code(s) erroné(s)</span>}</span> },
          { header: "Détail", className: "min-w-48", cell: (c) => <span className="block text-xs text-muted">{c.confirmedAt ? `Confirmé le ${formatDateTime(c.confirmedAt)}` : c.reportedAt ? `Signalé le ${formatDateTime(c.reportedAt)}` : `Créé le ${formatDateTime(c.createdAt)}`}{c.note ? ` · ${c.note}` : ""}</span> },
          { header: "Actions", cell: (c) => <AdminCashActions cash={c} /> },
        ]}
      />
      <Pagination page={r.page} totalPages={r.totalPages} basePath="/admin/especes" params={{ q: sp.q, status: sp.status }} />
    </>
  );
}
