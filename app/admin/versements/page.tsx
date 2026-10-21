import type { Metadata } from "next";
import { pageAdmin } from "@/lib/auth/page";
import { formatDateTime } from "@/lib/dates";
import { formatFcfa } from "@/lib/money";
import { PAYOUT_STATUS } from "@/lib/labels";
import { listPayouts } from "@/services/admin";
import { pendingPayouts } from "@/services/payouts";
import { Card, CardHeader, PageHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Notice } from "@/components/ui/states";
import { Pagination } from "@/components/ui/pagination";
import { RunAllPayouts, RunPayout } from "@/features/admin/finance-actions";

export const metadata: Metadata = { title: "Versements", robots: { index: false } };

export default async function Page({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const actor = await pageAdmin("ADMIN_PAYOUTS");
  const sp = await searchParams;
  const [pending, history] = await Promise.all([pendingPayouts(), listPayouts(actor, { page: Number(sp.page) || 1 })]);
  const eligible = pending.filter((p) => p.balance.payable > 0 && p.lender.payoutAccount && p.lender.status !== "SUSPENDED");
  return (
    <>
      <PageHeader title="Versements aux loueurs" description="Un montant devient versable après la fin de location et le délai de gel, hors litige. Les remboursements à compenser sont déduits." actions={<RunAllPayouts disabled={eligible.length === 0} />} />
      <div className="mb-5"><Notice tone="warning" title="Versements simulés">Dans cette version, un versement est enregistré comptablement mais aucun fonds réel n&apos;est transféré. Un connecteur bancaire ou mobile money se branche sur le même flux.</Notice></div>

      <Card>
        <CardHeader title="Soldes en attente" description={`${eligible.length} loueur${eligible.length > 1 ? "s" : ""} éligible${eligible.length > 1 ? "s" : ""} au versement`} />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead><tr className="border-b border-line bg-surface-2/60 text-xs font-semibold uppercase tracking-wide text-muted"><th className="px-4 py-3">Loueur</th><th className="px-4 py-3 text-right">Gelé</th><th className="px-4 py-3 text-right">Bloqué</th><th className="px-4 py-3 text-right">Déductions</th><th className="px-4 py-3 text-right">À verser</th><th className="px-4 py-3"></th></tr></thead>
            <tbody className="divide-y divide-line">
              {pending.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-muted">Aucun solde en attente.</td></tr>}
              {pending.map((p) => (
                <tr key={p.lender.id}>
                  <td className="px-4 py-3"><span className="font-medium text-ink">{p.lender.companyName}</span> {!p.lender.payoutAccount && <Badge tone="warning">Sans coordonnées</Badge>} {p.lender.status === "SUSPENDED" && <Badge tone="danger">Suspendu</Badge>}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatFcfa(p.balance.frozen)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatFcfa(p.balance.blocked)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{p.balance.owed > 0 ? formatFcfa(p.balance.owed) : ""}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums text-ink">{formatFcfa(p.balance.payable)}</td>
                  <td className="px-4 py-3 text-right"><RunPayout lenderId={p.lender.id} disabled={p.balance.payable <= 0 || !p.lender.payoutAccount || p.lender.status === "SUSPENDED"} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <h2 className="mb-3 mt-8 text-lg font-semibold text-ink">Historique</h2>
      <DataTable
        rows={history.rows}
        rowKey={(p) => p.id}
        empty={{ title: "Aucun versement", description: "Les versements effectués apparaissent ici." }}
        columns={[
          { header: "Référence", cell: (p) => <span className="font-mono text-[13px]">{p.reference}</span> },
          { header: "Loueur", cell: (p) => p.lender.companyName },
          { header: "Date", cell: (p) => formatDateTime(p.paidAt ?? p.createdAt) },
          { header: "Montant", align: "right", cell: (p) => formatFcfa(p.amount) },
          { header: "Statut", cell: (p) => <StatusBadge entry={PAYOUT_STATUS[p.status]} /> },
        ]}
      />
      <Pagination page={history.page} totalPages={history.totalPages} basePath="/admin/versements" />
    </>
  );
}
