import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { can } from "@/lib/auth/actor";
import { pageLender } from "@/lib/auth/page";
import { addDays, formatDate, todayUTC } from "@/lib/dates";
import { formatFcfa } from "@/lib/money";
import { RESERVATION_STATUS } from "@/lib/labels";
import { lenderBalance, lenderRevenueByMonth } from "@/services/payouts";
import { PLAN_LABEL, simulatePlans } from "@/services/plans";
import { Card, CardHeader, PageHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { KpiCard } from "@/components/ui/misc";
import { Notice } from "@/components/ui/states";
import { BarChart } from "@/components/charts/bar-chart";
import { Bank, CalendarCheck, ChartLineUp, ClockCountdown, Package, ShieldCheck } from "@/components/ui/icons";

export const metadata: Metadata = { title: "Tableau de bord loueur", robots: { index: false } };

const MONTH = new Intl.DateTimeFormat("fr-FR", { month: "short", timeZone: "UTC" });

export default async function LenderDashboard({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const actor = await pageLender();
  const sp = await searchParams;
  const lenderId = actor.lenderId;
  const today = todayUTC();
  const showFinance = can(actor, "FINANCE_VIEW");
  const freezeHours = (await getSettings())["payout.freeze_hours"];

  const planHint = can(actor, "COMPANY_MANAGE") || can(actor, "FINANCE_VIEW") ? await simulatePlans(actor.lenderId) : null;
  const [balance, revenue, upcoming, toValidate, toReturn, deliveriesToday, mods, openDisputes, products, deposits, stock] = await Promise.all([
    showFinance ? lenderBalance(lenderId) : null,
    showFinance ? lenderRevenueByMonth(lenderId, 6) : [],
    db.reservationItem.findMany({ where: { lenderId, status: { in: ["PAID", "CONFIRMED", "READY"] }, startDate: { gte: today } }, include: { reservation: { select: { id: true, reference: true, fulfillmentType: true, client: { select: { firstName: true, lastName: true } } } } }, orderBy: { startDate: "asc" }, take: 6 }),
    db.reservationItem.count({ where: { lenderId, status: "PAID" } }),
    db.reservationItem.count({ where: { lenderId, status: { in: ["IN_USE", "RETURN_PENDING"] }, returnReport: null, endDate: { lte: addDays(today, 1) } } }),
    db.delivery.count({ where: { lenderId, status: { in: ["PENDING", "PREPARING", "OUT_FOR_DELIVERY"] }, scheduledDate: { lte: addDays(today, 1) }, reservation: { status: { notIn: ["HOLD", "PENDING_PAYMENT", "CANCELLED", "REFUNDED"] } } } }),
    db.modificationRequest.count({ where: { lenderId, status: "PENDING_VALIDATION" } }),
    db.dispute.count({ where: { lenderId, status: { in: ["OPEN", "UNDER_REVIEW", "WAITING_RESPONSE"] } } }),
    db.product.count({ where: { lenderId, status: "PUBLISHED", deletedAt: null } }),
    db.deposit.aggregate({ where: { status: "HELD", item: { lenderId } }, _sum: { amount: true } }),
    db.product.aggregate({ where: { lenderId, deletedAt: null }, _sum: { stockQuantity: true } }),
  ]);

  const chart = revenue.map((r) => ({ label: MONTH.format(new Date(`${r.month}-01T00:00:00Z`)), values: { net: r.net, commission: r.commission } }));
  const alerts = [
    toValidate > 0 && { href: "/loueur/reservations?tab=to_validate", text: `${toValidate} ligne${toValidate > 1 ? "s" : ""} à valider`, tone: "warning" as const },
    mods > 0 && { href: "/loueur/reservations?tab=modifications", text: `${mods} demande${mods > 1 ? "s" : ""} de modification à traiter sous 2 h`, tone: "danger" as const },
    toReturn > 0 && { href: "/loueur/retours", text: `${toReturn} retour${toReturn > 1 ? "s" : ""} à constater`, tone: "warning" as const },
    deliveriesToday > 0 && { href: "/loueur/livraisons", text: `${deliveriesToday} livraison${deliveriesToday > 1 ? "s" : ""} à traiter aujourd'hui ou demain`, tone: "info" as const },
    openDisputes > 0 && { href: "/loueur/litiges", text: `${openDisputes} litige${openDisputes > 1 ? "s" : ""} ouvert${openDisputes > 1 ? "s" : ""}`, tone: "danger" as const },
  ].filter(Boolean) as { href: string; text: string; tone: "warning" | "danger" | "info" }[];

  return (
    <>
      {sp.denied && <div className="mb-6"><Notice tone="warning">Votre rôle ne permet pas d&apos;accéder à cette page.</Notice></div>}
      <PageHeader title="Tableau de bord" description="Activité, stock, retours et montants en attente de versement." />
      {planHint && planHint.saving > 0 && (
        <Link href="/loueur/abonnement" className="mb-6 block transition hover:-translate-y-0.5">
          <Notice tone="success" title={`Économisez ${formatFcfa(planHint.saving)} par mois`}>
            Sur vos 30 derniers jours ({formatFcfa(planHint.volume)} de locations), la formule {PLAN_LABEL[planHint.best]} vous aurait coûté moins cher que votre formule {PLAN_LABEL[planHint.current]}. Voir les formules.
          </Notice>
        </Link>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {balance && <KpiCard primary label="Disponible au versement" value={formatFcfa(balance.payable)} hint={`${formatFcfa(balance.frozen)} gelés en attente de fin de contestation`} icon={<Bank size={20} />} />}
        <KpiCard label="Réservations à venir" value={upcoming.length} hint={upcoming[0] ? `Prochaine : ${formatDate(upcoming[0].startDate)}` : "Aucune pour le moment"} icon={<CalendarCheck size={20} />} />
        <KpiCard label="Produits publiés" value={products} hint={`${stock._sum.stockQuantity ?? 0} unités en stock`} icon={<Package size={20} />} />
        <KpiCard label="Cautions détenues" value={formatFcfa(deposits._sum.amount ?? 0)} hint="Bloquées jusqu'au constat de retour" icon={<ShieldCheck size={20} />} />
      </div>

      {alerts.length > 0 && (
        <section className="mt-6" aria-label="Alertes">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {alerts.map((a) => (
              <Link key={a.href + a.text} href={a.href} className="block transition hover:-translate-y-0.5"><Notice tone={a.tone}>{a.text}</Notice></Link>
            ))}
          </div>
        </section>
      )}

      <div className="mt-8 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        {showFinance && (
          <Card>
            <CardHeader title="Revenus des 6 derniers mois" description="Part nette du loueur et commission LOC'CONNECT" action={<ChartLineUp size={20} className="text-royal-ink" />} />
            <div className="p-5">
              {chart.length === 0 ? <p className="py-10 text-center text-sm text-muted">Pas encore de revenus.</p> : <BarChart data={chart} series={[{ key: "net", label: "Part loueur" }, { key: "commission", label: "Commission" }]} unit="fcfa" ariaLabel="Revenus mensuels du loueur : part nette et commission" />}
            </div>
          </Card>
        )}
        <Card className={showFinance ? "" : "xl:col-span-2"}>
          <CardHeader title="Réservations à venir" action={<Link href="/loueur/reservations" className="text-sm font-medium text-royal-ink hover:underline">Tout voir</Link>} />
          {upcoming.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted">Aucune réservation à venir.</p>
          ) : (
            <ul className="divide-y divide-line">
              {upcoming.map((i) => (
                <li key={i.id}>
                  <Link href={`/loueur/reservations/${i.reservation.id}`} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3.5 transition hover:bg-surface-2/50">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">{i.quantity} x {i.productName}</p>
                      <p className="text-xs text-muted">{i.reservation.client.firstName} {i.reservation.client.lastName.slice(0, 1)}. · {formatDate(i.startDate)} · {i.reservation.fulfillmentType === "DELIVERY" ? "livraison" : "retrait"}</p>
                    </div>
                    <StatusBadge entry={RESERVATION_STATUS[i.status]} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {balance && (
        <Card className="mt-6">
          <CardHeader title="Où en est mon argent ?" description={`Versement ${freezeHours} h après la fin de location, sauf litige`} action={<ClockCountdown size={20} className="text-royal-ink" />} />
          <dl className="grid gap-px bg-line sm:grid-cols-2 xl:grid-cols-4">
            {[
              { l: "Gelé", v: balance.frozen, d: "Fin de location + délai de gel pas encore atteint" },
              { l: "Bloqué", v: balance.blocked, d: "Litige ou contestation en cours" },
              { l: "Déductions", v: balance.owed, d: "Remboursements à compenser" },
              { l: "Déjà versé", v: balance.paidTotal, d: "Total des versements reçus" },
            ].map((x) => (
              <div key={x.l} className="bg-surface p-5">
                <dt className="text-sm text-muted">{x.l}</dt>
                <dd className="mt-1 text-xl font-semibold tabular-nums text-ink">{formatFcfa(x.v)}</dd>
                <p className="mt-1 text-xs text-muted">{x.d}</p>
              </div>
            ))}
          </dl>
        </Card>
      )}
    </>
  );
}
