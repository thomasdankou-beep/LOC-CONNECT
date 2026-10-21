import type { Metadata } from "next";
import { pageAdmin } from "@/lib/auth/page";
import { formatDate } from "@/lib/dates";
import { LENDER_STATUS, PAYMENT_MODE } from "@/lib/labels";
import { getSettings } from "@/lib/settings";
import { listLenders } from "@/services/admin";
import { commissionRateFor } from "@/services/plans";
import { PageHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";
import { FilterBar } from "@/components/ui/filter-bar";
import { LenderActions } from "@/features/admin/moderation-actions";

export const metadata: Metadata = { title: "Loueurs", robots: { index: false } };

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; page?: string }> }) {
  const actor = await pageAdmin("ADMIN_LENDERS");
  const sp = await searchParams;
  const [r, settings] = await Promise.all([listLenders(actor, { q: sp.q, status: sp.status, page: Number(sp.page) || 1 }), getSettings()]);
  const defaultBps = settings["commission.rate_bps"];
  return (
    <>
      <PageHeader title="Loueurs" description="Validation des entreprises, suspension, commission spécifique et ouverture du paiement en espèces par loueur." />
      <FilterBar basePath="/admin/loueurs" q={sp.q} status={sp.status} statuses={Object.entries(LENDER_STATUS).map(([value, e]) => ({ value, label: e.label }))} placeholder="Nom de l'entreprise" />
      <DataTable
        rows={r.rows}
        rowKey={(l) => l.id}
        empty={{ title: "Aucun loueur", description: "Aucun loueur ne correspond à ces filtres." }}
        columns={[
          { header: "Entreprise", className: "min-w-56", cell: (l) => <span className="block"><span className="block font-medium text-ink">{l.companyName}</span><span className="block text-xs text-muted">{l.owner.firstName} {l.owner.lastName} · {l.owner.email}</span><span className="block text-xs text-muted">Inscrit le {formatDate(l.createdAt)} · {l._count.members} sous-compte{l._count.members > 1 ? "s" : ""}</span></span> },
          { header: "Ville", cell: (l) => l.city.name },
          { header: "Produits", align: "right", cell: (l) => l._count.products },
          { header: "Commission", cell: (l) => <span className="block"><span className="block">{commissionRateFor(l, settings) / 100} %{l.commissionRateBps != null && <Badge tone="info" className="ml-1">spécifique {l.commissionRateBps / 100} %</Badge>}</span><span className="block text-xs text-muted">Formule {{ FREE: "Découverte", PRO: "Pro", PREMIUM: "Premium" }[l.plan]}{l.nextPlan ? ` (puis ${{ FREE: "Découverte", PRO: "Pro", PREMIUM: "Premium" }[l.nextPlan]})` : ""}</span></span> },
          { header: "Paiement", cell: (l) => <span className="block"><Badge tone={l.paymentMode === "DEPOSIT_CASH" ? "warning" : "neutral"}>{PAYMENT_MODE[l.paymentMode].short}</Badge>{l.cashModeAllowed && l.paymentMode !== "DEPOSIT_CASH" && <span className="mt-1 block text-xs text-muted">Espèces autorisées</span>}</span> },
          { header: "Statut", cell: (l) => <div><StatusBadge entry={LENDER_STATUS[l.status]} />{l.rejectionReason && l.status !== "APPROVED" && <p className="mt-1 max-w-48 text-xs text-muted">{l.rejectionReason}</p>}</div> },
          { header: "Actions", className: "min-w-52", cell: (l) => <LenderActions id={l.id} status={l.status} commissionBps={l.commissionRateBps} defaultBps={defaultBps} cashAllowed={l.cashModeAllowed} /> },
        ]}
      />
      <Pagination page={r.page} totalPages={r.totalPages} basePath="/admin/loueurs" params={{ q: sp.q, status: sp.status }} />
    </>
  );
}
