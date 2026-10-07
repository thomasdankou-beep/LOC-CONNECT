import type { Metadata } from "next";
import { db } from "@/lib/db";
import { pageAdmin } from "@/lib/auth/page";
import { formatDate } from "@/lib/dates";
import { formatFcfa } from "@/lib/money";
import { listSubscriptions } from "@/services/admin";
import { PageHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { SubscriptionForm } from "@/features/admin/finance-actions";
import { KpiCard } from "@/components/ui/misc";
import { Notice } from "@/components/ui/states";
import { getSettings } from "@/lib/settings";
import { planTerms } from "@/services/plans";

export const metadata: Metadata = { title: "Abonnements", robots: { index: false } };

const PLAN = { FREE: "Découverte", PRO: "Pro", PREMIUM: "Premium" } as const;

export default async function Page() {
  const actor = await pageAdmin("ADMIN_SUBSCRIPTIONS");
  const [subs, lenders, settings, counts] = await Promise.all([
    listSubscriptions(actor),
    db.lender.findMany({ where: { status: "APPROVED" }, select: { id: true, companyName: true }, orderBy: { companyName: "asc" } }),
    getSettings(),
    db.lender.groupBy({ by: ["plan"], where: { status: "APPROVED" }, _count: true }),
  ]);
  const terms = planTerms(settings);
  const count = (p: keyof typeof PLAN) => counts.find((c) => c.plan === p)?._count ?? 0;
  return (
    <>
      <PageHeader title="Abonnements" description="Formules des loueurs : la formule fixe le taux de commission. Les prix et taux se règlent dans Paramètres, section Formules." actions={<SubscriptionForm lenders={lenders.map((l) => ({ id: l.id, name: l.companyName }))} />} />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        {(["FREE", "PRO", "PREMIUM"] as const).map((p) => (
          <KpiCard key={p} label={`${PLAN[p]} : ${terms[p].price ? `${formatFcfa(terms[p].price)} / mois` : "gratuite"}, ${terms[p].rateBps / 100} %`} value={count(p)} hint={`loueur${count(p) > 1 ? "s" : ""} validé${count(p) > 1 ? "s" : ""}`} />
        ))}
      </div>
      {!settings["plan.self_service"] && <div className="mb-6"><Notice tone="info">Le libre choix est désactivé : seuls les administrateurs attribuent les formules.</Notice></div>}
      <DataTable
        rows={subs}
        rowKey={(s) => s.id}
        empty={{ title: "Aucun abonnement", description: "Attribuez une formule à un loueur pour commencer." }}
        columns={[
          { header: "Loueur", cell: (s) => s.lender.companyName },
          { header: "Formule", cell: (s) => PLAN[s.plan] },
          { header: "Prix mensuel", align: "right", cell: (s) => formatFcfa(s.price) },
          { header: "Commission", align: "right", cell: (s) => (s.rateBps != null ? `${s.rateBps / 100} %` : "") },
          { header: "Facturé", align: "right", cell: (s) => <span className="block">{formatFcfa(s.periodFee)}{s.note && <span className="block text-xs text-muted">{s.note}</span>}</span> },
          { header: "Début", cell: (s) => formatDate(s.startsAt) },
          { header: "Fin", cell: (s) => (s.endsAt ? formatDate(s.endsAt) : "Sans échéance") },
          { header: "Statut", cell: (s) => <Badge tone={s.status === "ACTIVE" ? "success" : "neutral"}>{s.status === "ACTIVE" ? "Actif" : s.status === "CANCELLED" ? "Clôturé" : "Expiré"}</Badge> },
        ]}
      />
    </>
  );
}
