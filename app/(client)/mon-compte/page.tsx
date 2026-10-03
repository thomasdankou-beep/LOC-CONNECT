import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireClient } from "@/lib/auth/actor";
import { formatDate, formatDateTime, todayUTC } from "@/lib/dates";
import { formatFcfa } from "@/lib/money";
import { RESERVATION_STATUS } from "@/lib/labels";
import { Card, CardHeader, PageHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { KpiCard } from "@/components/ui/misc";
import { EmptyState, Notice } from "@/components/ui/states";
import { LinkButton } from "@/components/ui/button";
import { CalendarCheck, CreditCard, ShieldCheck, ClockCountdown, Bell } from "@/components/ui/icons";
import { nextActionForClient } from "@/features/reservations/helpers";

export const metadata: Metadata = { title: "Mon tableau de bord", robots: { index: false } };

export default async function ClientDashboard() {
  const actor = await requireClient();
  const today = todayUTC();
  const [items, deposits, payments, extra, contestable, mods, notifications, holds] = await Promise.all([
    db.reservationItem.findMany({ where: { reservation: { clientId: actor.userId }, status: { notIn: ["HOLD", "DRAFT", "CANCELLED", "REFUNDED"] } }, include: { reservation: { select: { id: true, reference: true, fulfillmentType: true } }, lender: { select: { companyName: true } } }, orderBy: { startDate: "asc" } }),
    db.deposit.aggregate({ where: { status: "HELD", item: { reservation: { clientId: actor.userId } } }, _sum: { amount: true } }),
    db.payment.aggregate({ where: { userId: actor.userId, status: { in: ["PAID", "PARTIALLY_REFUNDED", "REFUNDED"] }, createdAt: { gte: new Date(today.getTime() - 30 * 86_400_000) } }, _sum: { amount: true } }),
    db.extraCharge.findMany({ where: { status: "PENDING", item: { reservation: { clientId: actor.userId } } }, include: { item: { select: { productName: true, reservationId: true } } } }),
    db.returnReport.findMany({ where: { status: "SUBMITTED", item: { reservation: { clientId: actor.userId } } }, include: { item: { select: { productName: true, reservationId: true } } } }),
    db.modificationRequest.findMany({ where: { clientId: actor.userId, status: "PENDING_PAYMENT" }, include: { reservation: { select: { reference: true, id: true } } } }),
    db.notification.findMany({ where: { userId: actor.userId, channel: "INTERNAL" }, orderBy: { createdAt: "desc" }, take: 5 }),
    db.hold.findMany({ where: { userId: actor.userId, status: "ACTIVE", expiresAt: { gt: new Date() } }, select: { id: true, expiresAt: true } }),
  ]);

  const active = items.filter((i) => ["DELIVERING", "DELIVERED", "IN_USE", "RETURN_PENDING", "RETURNED", "DISPUTED"].includes(i.status));
  const upcoming = items.filter((i) => ["PAID", "CONFIRMED", "READY"].includes(i.status) && i.startDate >= today);
  const next = upcoming[0];
  const alerts: { key: string; tone: "warning" | "danger" | "info"; title: string; body: string; href: string }[] = [
    ...extra.map((e) => ({ key: `x${e.id}`, tone: "danger" as const, title: `Complément de ${formatFcfa(e.amount)} à régler`, body: e.item.productName, href: `/mes-reservations/${e.item.reservationId}` })),
    ...contestable.map((c) => ({ key: `c${c.id}`, tone: "warning" as const, title: "Constat de retour à examiner", body: `${c.item.productName}${c.contestDeadline ? `, contestation possible jusqu'au ${formatDateTime(c.contestDeadline)}` : ""}`, href: `/mes-reservations/${c.item.reservationId}` })),
    ...mods.map((m) => ({ key: `m${m.id}`, tone: "info" as const, title: `Modification acceptée : ${formatFcfa(m.differenceToPay)} à régler`, body: m.reservation.reference, href: `/mes-reservations/${m.reservation.id}` })),
    ...holds.map((h) => ({ key: `h${h.id}`, tone: "info" as const, title: "Un blocage de stock est en cours", body: `Finalisez le paiement avant ${formatDateTime(h.expiresAt)}`, href: `/paiement?hold=${h.id}` })),
  ];

  return (
    <>
      <PageHeader title={`Bonjour ${actor.firstName}`} description="Voici l'état de vos locations, de vos paiements et de vos cautions." actions={<LinkButton href="/catalogue">Louer du matériel</LinkButton>} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard primary label="Locations en cours" value={active.length} hint={active.length ? "Pensez aux dates de retour" : "Aucune pour le moment"} icon={<ClockCountdown size={20} />} />
        <KpiCard label="Prochaines locations" value={upcoming.length} hint={next ? `Prochaine : ${formatDate(next.startDate)}` : "Rien de prévu"} icon={<CalendarCheck size={20} />} />
        <KpiCard label="Cautions bloquées" value={formatFcfa(deposits._sum.amount ?? 0)} hint="Restituées après constat de retour" icon={<ShieldCheck size={20} />} />
        <KpiCard label="Payé sur 30 jours" value={formatFcfa(payments._sum.amount ?? 0)} hint="Paiements confirmés" icon={<CreditCard size={20} />} />
      </div>

      {alerts.length > 0 && (
        <section className="mt-8" aria-labelledby="h-alerts">
          <h2 id="h-alerts" className="mb-3 text-lg font-semibold text-ink">À traiter</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {alerts.map((a) => (
              <Link key={a.key} href={a.href} className="block transition hover:-translate-y-0.5">
                <Notice tone={a.tone} title={a.title}>{a.body}</Notice>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="mt-8 grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader title="Mes locations" description="En cours et à venir" action={<Link href="/mes-reservations" className="text-sm font-medium text-royal-ink hover:underline">Tout voir</Link>} />
          {[...active, ...upcoming].length === 0 ? (
            <div className="p-5"><EmptyState title="Aucune location active" description="Vos prochaines réservations apparaîtront ici." action={<LinkButton href="/catalogue" variant="secondary">Parcourir le catalogue</LinkButton>} /></div>
          ) : (
            <ul className="divide-y divide-line">
              {[...active, ...upcoming].slice(0, 6).map((i) => (
                <li key={i.id}>
                  <Link href={`/mes-reservations/${i.reservation.id}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 transition hover:bg-surface-2/50">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-ink">{i.quantity} x {i.productName}</p>
                      <p className="text-sm text-muted">{i.lender.companyName} · {formatDate(i.startDate)} au {formatDate(i.endDate)}</p>
                      <p className="mt-0.5 text-sm text-royal-ink">{nextActionForClient(i.status, { fulfillment: i.reservation.fulfillmentType })}</p>
                    </div>
                    <StatusBadge entry={RESERVATION_STATUS[i.status]} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Notifications récentes" action={<Link href="/mes-notifications" className="text-sm font-medium text-royal-ink hover:underline">Tout voir</Link>} />
          {notifications.length === 0 ? (
            <div className="p-5"><EmptyState icon={<Bell size={22} />} title="Aucune notification" /></div>
          ) : (
            <ul className="divide-y divide-line">
              {notifications.map((n) => (
                <li key={n.id}>
                  <Link href={n.link ?? "/mes-notifications"} className="block px-5 py-3.5 transition hover:bg-surface-2/50">
                    <p className={`text-sm ${n.readAt ? "text-ink" : "font-semibold text-ink"}`}>{n.title}</p>
                    <p className="mt-0.5 line-clamp-2 text-sm text-muted">{n.body}</p>
                    <p className="mt-1 text-xs text-muted">{formatDateTime(n.createdAt)}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
