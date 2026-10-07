import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { can } from "@/lib/auth/actor";
import { pageLender } from "@/lib/auth/page";
import { formatDate } from "@/lib/dates";
import { formatFcfa } from "@/lib/money";
import { getSettings } from "@/lib/settings";
import { PLAN_LABEL, PLAN_ORDER, PLAN_PERKS, lenderSubscriptions, quotePlanChange, simulatePlans } from "@/services/plans";
import { Card, CardHeader, PageHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Notice } from "@/components/ui/states";
import { PlanChooser } from "@/features/lender/plan-chooser";

export const metadata: Metadata = { title: "Abonnement", robots: { index: false } };

export default async function Page() {
  const actor = await pageLender(["COMPANY_MANAGE", "FINANCE_VIEW"]);
  const [settings, lender, sim, history, invoices] = await Promise.all([
    getSettings(),
    db.lender.findUniqueOrThrow({ where: { id: actor.lenderId } }),
    simulatePlans(actor.lenderId),
    lenderSubscriptions(actor.lenderId),
    db.invoice.findMany({ where: { lenderId: actor.lenderId, kind: "SUBSCRIPTION" }, select: { id: true, sourceKey: true, number: true } }),
  ]);
  const canChange = actor.isLenderOwner || can(actor, "COMPANY_MANAGE");
  const quotes = await Promise.all(PLAN_ORDER.map((p) => quotePlanChange(db, actor.lenderId, p, settings)));
  const cards = sim.rows.map((r, i) => ({
    plan: r.plan,
    label: PLAN_LABEL[r.plan],
    price: r.price,
    ratePct: r.rateBps / 100,
    perks: PLAN_PERKS[r.plan],
    estimate: r.cost,
    best: r.plan === sim.best,
    current: r.plan === lender.plan,
    scheduled: r.plan === lender.nextPlan,
    quote: { ...quotes[i], effectiveAt: quotes[i].effectiveAt?.toISOString() ?? null },
  }));
  const invoiceOf = (subId: string) => invoices.find((i) => i.sourceKey === `SUB:${subId}`);

  return (
    <>
      <PageHeader title="Abonnement" description="Choisissez la formule qui vous coûte le moins selon votre activité : sans abonnement, vous payez la commission standard ; avec Pro ou Premium, un prix fixe par mois et une commission réduite." />

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Card className="p-5">
          <p className="text-sm text-muted">Votre formule</p>
          <p className="mt-1 text-2xl font-semibold text-ink">{PLAN_LABEL[lender.plan]}</p>
          <p className="text-sm text-muted">{lender.planRenewsAt ? `${lender.nextPlan ? `Passage en ${PLAN_LABEL[lender.nextPlan]}` : "Renouvellement"} le ${formatDate(lender.planRenewsAt)}` : "Sans engagement, sans frais fixe"}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted">Vos locations sur 30 jours</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">{formatFcfa(sim.volume)}</p>
          <p className="text-sm text-muted">Base des estimations ci-dessous</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted">Économie possible</p>
          <p className={`mt-1 text-2xl font-semibold tabular-nums ${sim.saving > 0 ? "text-success" : "text-ink"}`}>{formatFcfa(sim.saving)} <span className="text-sm font-normal text-muted">/ mois</span></p>
          <p className="text-sm text-muted">{sim.saving > 0 ? `Avec la formule ${PLAN_LABEL[sim.best]}` : "Vous êtes déjà sur la formule la plus avantageuse"}</p>
        </Card>
      </div>

      {lender.commissionRateBps != null && <div className="mb-6"><Notice tone="info">Vous bénéficiez d&apos;un taux spécifique de {lender.commissionRateBps / 100} % : c&apos;est le taux le plus bas entre celui-ci et celui de votre formule qui s&apos;applique.</Notice></div>}
      {!settings["plan.self_service"] && <div className="mb-6"><Notice tone="info">Les formules Pro et Premium sont attribuées par LOC&apos;CONNECT. <Link href="/contact" className="font-medium underline">Contactez-nous</Link> pour en changer.</Notice></div>}
      {settings["plan.first_month_free"] && !history.some((h) => h.plan !== "FREE") && <div className="mb-6"><Notice tone="success" title="Premier mois offert">Votre premier mois en formule Pro ou Premium n&apos;est pas facturé.</Notice></div>}

      <PlanChooser cards={cards} canChange={canChange} selfService={settings["plan.self_service"]} />
      <p className="mt-3 text-xs text-muted">Estimation : prix de la formule plus commission sur vos locations des 30 derniers jours. Le prix d&apos;une formule est déduit de vos versements au début de chaque mois ; une facture vous est adressée.</p>

      <Card className="mt-8">
        <CardHeader title="Historique" description="Périodes, montants facturés et factures d'abonnement" />
        <DataTable
          rows={history}
          rowKey={(h) => h.id}
          empty={{ title: "Aucune période", description: "Vous êtes en formule Découverte depuis votre inscription." }}
          columns={[
            { header: "Formule", cell: (h) => PLAN_LABEL[h.plan] },
            { header: "Période", cell: (h) => `${formatDate(h.startsAt)}${h.endsAt ? ` au ${formatDate(h.endsAt)}` : ""}` },
            { header: "Commission", cell: (h) => (h.rateBps != null ? `${h.rateBps / 100} %` : "") },
            { header: "Facturé", align: "right", cell: (h) => formatFcfa(h.periodFee) },
            { header: "Statut", cell: (h) => <Badge tone={h.status === "ACTIVE" ? "success" : "neutral"}>{h.status === "ACTIVE" ? "En cours" : h.status === "CANCELLED" ? "Remplacée" : "Terminée"}</Badge> },
            { header: "Facture", cell: (h) => { const inv = invoiceOf(h.id); return inv ? <Link href={`/factures/${inv.id}`} className="font-mono text-[13px] text-royal-ink hover:underline">{inv.number}</Link> : <span className="text-muted">{h.note ?? ""}</span>; } },
          ]}
        />
      </Card>
    </>
  );
}
