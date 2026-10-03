import type { Metadata } from "next";
import { db } from "@/lib/db";
import { can } from "@/lib/auth/actor";
import { pageLender } from "@/lib/auth/page";
import { formatDate, formatDateTime } from "@/lib/dates";
import { formatFcfa } from "@/lib/money";
import { PAYOUT_METHOD, PAYOUT_STATUS } from "@/lib/labels";
import { getSettings } from "@/lib/settings";
import { lenderBalance, listLenderPayouts } from "@/services/payouts";
import { Card, CardHeader, PageHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/badge";
import { KpiCard } from "@/components/ui/misc";
import { Notice } from "@/components/ui/states";
import { PayoutDetailsRequest } from "@/features/lender/payout-details-form";
import { Bank, ClockCountdown, Scales } from "@/components/ui/icons";

export const metadata: Metadata = { title: "Versements", robots: { index: false } };

export default async function Page() {
  const actor = await pageLender(["PAYOUT_VIEW", "FINANCE_VIEW"]);
  const [balance, payouts, lender, pending, settings] = await Promise.all([
    lenderBalance(actor.lenderId),
    listLenderPayouts(actor.lenderId),
    db.lender.findUniqueOrThrow({ where: { id: actor.lenderId }, select: { payoutMethod: true, payoutAccount: true } }),
    db.validationAction.findFirst({ where: { type: "PAYOUT_DETAILS", entityId: actor.lenderId, status: "PENDING" } }),
    getSettings(),
  ]);
  const account = lender.payoutAccount ? `${"*".repeat(Math.max(0, lender.payoutAccount.length - 4))}${lender.payoutAccount.slice(-4)}` : null;
  const canChange = can(actor, "COMPANY_MANAGE") || actor.isLenderOwner;

  return (
    <>
      <PageHeader title="Versements" description={`Les montants sont versés ${settings["payout.freeze_hours"]} h après la fin de la location, sauf litige ou contestation en cours.`} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard primary label="Prochain versement" value={formatFcfa(balance.payable)} icon={<Bank size={20} />} hint="Disponible moins déductions" />
        <KpiCard label="Gelé" value={formatFcfa(balance.frozen)} icon={<ClockCountdown size={20} />} hint="Délai de contestation en cours" />
        <KpiCard label="Bloqué" value={formatFcfa(balance.blocked)} icon={<Scales size={20} />} hint="Litige ou contestation" />
        <KpiCard label="Déjà versé" value={formatFcfa(balance.paidTotal)} hint="Total reçu depuis l'inscription" />
      </div>
      {balance.owed > 0 && <div className="mt-6"><Notice tone="warning" title="Déductions à compenser">{formatFcfa(balance.owed)} de remboursements clients seront déduits de votre prochain versement.</Notice></div>}

      <Card className="mt-6">
        <CardHeader title="Coordonnées de versement" description="Modifiables après validation de l'administration" action={<PayoutDetailsRequest disabled={!canChange || Boolean(pending)} />} />
        <div className="p-5 text-sm">
          {lender.payoutMethod ? <p className="text-ink">{PAYOUT_METHOD[lender.payoutMethod] ?? lender.payoutMethod} · <span className="font-mono">{account}</span></p> : <p className="text-muted">Aucune coordonnée enregistrée.</p>}
          {pending && <div className="mt-3"><Notice tone="info">Une demande de modification est en attente de validation depuis le {formatDate(pending.requestedAt)}.</Notice></div>}
        </div>
      </Card>

      <h2 className="mb-3 mt-8 text-lg font-semibold text-ink">Historique des versements</h2>
      <DataTable
        rows={payouts}
        rowKey={(p) => p.id}
        empty={{ title: "Aucun versement", description: "Votre premier versement apparaîtra ici une fois la période de gel écoulée." }}
        columns={[
          { header: "Référence", cell: (p) => <span className="font-mono text-[13px]">{p.reference}</span> },
          { header: "Créé le", cell: (p) => formatDateTime(p.createdAt) },
          { header: "Versé le", cell: (p) => (p.paidAt ? formatDateTime(p.paidAt) : "") },
          { header: "Montant", align: "right", cell: (p) => formatFcfa(p.amount) },
          { header: "Statut", cell: (p) => <StatusBadge entry={PAYOUT_STATUS[p.status]} /> },
        ]}
      />
    </>
  );
}
