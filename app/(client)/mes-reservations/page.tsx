import type { Metadata } from "next";
import Link from "next/link";
import { requireClient } from "@/lib/auth/actor";
import { formatDate } from "@/lib/dates";
import { formatFcfa } from "@/lib/money";
import { RESERVATION_STATUS } from "@/lib/labels";
import { listClientReservations } from "@/services/reservations";
import { Card, PageHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { Tabs } from "@/components/ui/misc";
import { EmptyState } from "@/components/ui/states";
import { LinkButton } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { Photo } from "@/components/ui/photo";
import { CalendarCheck } from "@/components/ui/icons";
import { nextActionForClient, RESERVATION_TABS } from "@/features/reservations/helpers";

export const metadata: Metadata = { title: "Mes réservations", robots: { index: false } };

export default async function MyReservations({ searchParams }: { searchParams: Promise<{ tab?: string; page?: string }> }) {
  const actor = await requireClient();
  const sp = await searchParams;
  const tab = RESERVATION_TABS.find((t) => t.key === sp.tab) ?? RESERVATION_TABS[0];
  const page = Math.max(1, Number(sp.page) || 1);
  const result = await listClientReservations(actor.userId, { status: tab.statuses ? ([...tab.statuses] as never[]) : undefined, page, pageSize: 8 });

  return (
    <>
      <PageHeader title="Mes réservations" description="Suivez chaque commande, du paiement à la restitution de la caution." actions={<LinkButton href="/catalogue">Nouvelle réservation</LinkButton>} />
      <Tabs active={tab.key} items={RESERVATION_TABS.map((t) => ({ key: t.key, label: t.label, href: `/mes-reservations${t.key === "all" ? "" : `?tab=${t.key}`}` }))} />
      {result.rows.length === 0 ? (
        <EmptyState icon={<CalendarCheck size={24} />} title="Aucune réservation ici" description="Vos réservations apparaîtront dès votre première commande." action={<LinkButton href="/catalogue">Parcourir le catalogue</LinkButton>} />
      ) : (
        <ul className="space-y-4">
          {result.rows.map((r) => {
            const lenders = [...new Set(r.items.map((i) => i.lender.companyName))];
            const first = r.items[0];
            return (
              <li key={r.id}>
                <Card className="overflow-hidden transition hover:-translate-y-0.5">
                  <Link href={`/mes-reservations/${r.id}`} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
                    <Photo src={first?.product.photos[0]?.url} alt="" w={240} h={180} className="hidden aspect-[4/3] w-28 shrink-0 rounded-control sm:block" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-mono text-sm font-medium text-ink">{r.reference}</p>
                        <StatusBadge entry={RESERVATION_STATUS[r.status]} />
                        {r.payments[0]?.provider === "simulated" && <span className="text-xs text-muted">paiement simulé</span>}
                      </div>
                      <p className="mt-1.5 truncate text-[15px] text-ink">{r.items.map((i) => `${i.quantity} x ${i.productName}`).join(", ")}</p>
                      <p className="mt-0.5 text-sm text-muted">{lenders.join(", ")} · du {first ? formatDate(first.startDate) : ""} · {formatDate(r.createdAt)}</p>
                      <p className="mt-1 text-sm text-royal-ink">{nextActionForClient(r.status, { fulfillment: r.fulfillmentType })}</p>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="text-lg font-semibold tabular-nums text-ink">{formatFcfa(r.total)}</p>
                      <p className="text-xs text-muted">dont caution {formatFcfa(r.depositTotal)}</p>
                    </div>
                  </Link>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
      <Pagination page={result.page} totalPages={result.totalPages} basePath="/mes-reservations" params={{ tab: tab.key === "all" ? undefined : tab.key }} />
    </>
  );
}
