import type { Metadata } from "next";
import { pageAdmin } from "@/lib/auth/page";
import { formatDateTime } from "@/lib/dates";
import { formatFcfa } from "@/lib/money";
import { RECOVERY_STATUS } from "@/lib/labels";
import { listRecoveries } from "@/services/payouts";
import { PageHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";
import { FilterBar } from "@/components/ui/filter-bar";
import { RecoveryAction } from "@/features/admin/finance-actions";

export const metadata: Metadata = { title: "Recouvrements", robots: { index: false } };

export default async function Page({ searchParams }: { searchParams: Promise<{ status?: string; page?: string }> }) {
  await pageAdmin("ADMIN_RECOVERIES");
  const sp = await searchParams;
  const r = await listRecoveries({ status: sp.status, page: Number(sp.page) || 1 });
  return (
    <>
      <PageHeader title="Recouvrements" description="Remboursements clients dont la part du loueur avait déjà été versée. Ils sont compensés sur un prochain versement ou recouvrés manuellement." />
      <FilterBar basePath="/admin/recouvrements" status={sp.status} statuses={Object.entries(RECOVERY_STATUS).map(([value, e]) => ({ value, label: e.label }))} placeholder="Statut" />
      <DataTable
        rows={r.rows}
        rowKey={(x) => x.id}
        empty={{ title: "Aucun recouvrement", description: "Aucun remboursement n'a impacté un loueur déjà versé." }}
        columns={[
          { header: "Loueur", cell: (x) => x.lender.companyName },
          { header: "Réservation", cell: (x) => <span className="font-mono text-[13px]">{x.refund?.reservation.reference ?? ""}</span> },
          { header: "Remboursement", cell: (x) => <span className="font-mono text-[13px]">{x.refund?.reference ?? ""}</span> },
          { header: "Montant à recouvrer", align: "right", cell: (x) => formatFcfa(x.impactedAmount) },
          { header: "Créé le", cell: (x) => formatDateTime(x.createdAt) },
          { header: "Statut", cell: (x) => <StatusBadge entry={RECOVERY_STATUS[x.status]} /> },
          { header: "Action", cell: (x) => (x.status === "TO_RECOVER" ? <RecoveryAction id={x.id} /> : "") },
        ]}
      />
      <Pagination page={r.page} totalPages={r.totalPages} basePath="/admin/recouvrements" params={{ status: sp.status }} />
    </>
  );
}
