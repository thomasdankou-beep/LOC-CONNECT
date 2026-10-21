import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { can } from "@/lib/auth/actor";
import { pageLender } from "@/lib/auth/page";
import { addDays, formatDate, toISODate, todayUTC } from "@/lib/dates";
import { OCCUPYING_STATUSES } from "@/lib/state-machine";
import { listUnavailabilities } from "@/services/lenders";
import { Card, CardHeader, PageHeader } from "@/components/ui/card";
import { ActionButton, FormAction } from "@/components/ui/action";
import { CaretLeft, CaretRight } from "@/components/ui/icons";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Calendrier", robots: { index: false } };

const MONTH_FMT = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" });
const WEEKDAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

function parseMonth(m?: string): Date {
  if (m && /^\d{4}-\d{2}$/.test(m)) {
    const d = new Date(`${m}-01T00:00:00Z`);
    if (!Number.isNaN(d.getTime())) return d;
  }
  const t = todayUTC();
  return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), 1));
}
const monthKey = (d: Date) => d.toISOString().slice(0, 7);
const shiftMonth = (d: Date, n: number) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));

export default async function Page({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const actor = await pageLender(["CALENDAR_MANAGE", "ORDER_VIEW"]);
  const sp = await searchParams;
  const first = parseMonth(sp.m);
  const next = shiftMonth(first, 1);
  const offset = (first.getUTCDay() + 6) % 7;
  const gridStart = addDays(first, -offset);
  const gridEnd = addDays(gridStart, Math.ceil((offset + Math.round((next.getTime() - first.getTime()) / 86_400_000)) / 7) * 7);
  const lenderId = actor.lenderId;

  const [items, blocks, unavailabilities] = await Promise.all([
    db.reservationItem.findMany({ where: { lenderId, status: { in: OCCUPYING_STATUSES }, startDate: { lt: gridEnd }, endDate: { gt: gridStart } }, select: { id: true, productName: true, quantity: true, startDate: true, endDate: true, reservation: { select: { id: true, reference: true } } }, orderBy: { startDate: "asc" } }),
    db.availabilityBlock.findMany({ where: { product: { lenderId }, startDate: { lt: gridEnd }, endDate: { gt: gridStart } }, include: { product: { select: { id: true, name: true } } }, orderBy: { startDate: "asc" } }),
    listUnavailabilities(lenderId),
  ]);
  const canManage = can(actor, "CALENDAR_MANAGE");
  const today = toISODate(todayUTC());
  const days: Date[] = [];
  for (let d = gridStart; d < gridEnd; d = addDays(d, 1)) days.push(d);

  const cell = (d: Date) => {
    const iso = toISODate(d);
    const its = items.filter((i) => i.startDate <= d && i.endDate > d);
    const bl = blocks.filter((b) => b.startDate <= d && b.endDate > d);
    const off = unavailabilities.some((u) => u.startDate <= d && u.endDate > d);
    return { iso, its, bl, off, inMonth: d.getUTCMonth() === first.getUTCMonth() };
  };

  return (
    <>
      <PageHeader
        title="Calendrier"
        description="Réservations en cours, blocages de stock et périodes où vous n'acceptez aucune nouvelle réservation."
        actions={canManage && <FormAction endpoint="/api/lenders/me/unavailabilities" label="Me rendre indisponible" title="Période d'indisponibilité" description="Aucune nouvelle réservation ne sera possible sur cette période (fin exclue). Les réservations déjà payées ne sont pas modifiées." fields={[{ name: "startDate", label: "Début", type: "date", required: true }, { name: "endDate", label: "Fin", type: "date", required: true }, { name: "reason", label: "Motif", placeholder: "Ex : congés, inventaire" }]} submitLabel="Enregistrer" success="Indisponibilité enregistrée" variant="primary" size="md" />}
      />

      <Card>
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <h2 className="text-lg font-semibold capitalize text-ink">{MONTH_FMT.format(first)}</h2>
          <div className="flex items-center gap-2">
            <Link href={`/loueur/calendrier?m=${monthKey(shiftMonth(first, -1))}`} aria-label="Mois précédent" className="flex size-10 items-center justify-center rounded-control border border-line hover:bg-surface-2"><CaretLeft size={16} /></Link>
            <Link href="/loueur/calendrier" className="flex h-10 items-center rounded-control border border-line px-3 text-sm font-medium hover:bg-surface-2">Aujourd&apos;hui</Link>
            <Link href={`/loueur/calendrier?m=${monthKey(next)}`} aria-label="Mois suivant" className="flex size-10 items-center justify-center rounded-control border border-line hover:bg-surface-2"><CaretRight size={16} /></Link>
          </div>
        </div>
        <div className="grid grid-cols-7 border-b border-line bg-surface-2/60 text-center text-xs font-semibold uppercase tracking-wide text-muted">
          {WEEKDAYS.map((w) => <div key={w} className="py-2">{w}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {days.map((d, idx) => {
            const c = cell(d);
            const units = c.its.reduce((a, i) => a + i.quantity, 0);
            return (
              <div key={c.iso} className={cn("min-h-16 border-b border-r border-line p-1.5 sm:min-h-28 sm:p-2", (idx + 1) % 7 === 0 && "border-r-0", !c.inMonth && "bg-surface-2/40 text-muted", c.off && "bg-danger-soft/50")}>
                <div className="flex items-center justify-between">
                  <span className={cn("flex size-6 items-center justify-center rounded-full text-xs font-medium sm:size-7 sm:text-sm", c.iso === today ? "bg-royal text-white" : "text-ink")}>{d.getUTCDate()}</span>
                  {units > 0 && <span className="rounded-full bg-royal-soft px-1.5 text-[11px] font-semibold text-royal-ink sm:hidden">{units}</span>}
                </div>
                <ul className="mt-1 hidden space-y-1 sm:block">
                  {c.its.slice(0, 2).map((i) => (
                    <li key={i.id}><Link href={`/loueur/reservations/${i.reservation.id}`} className="block truncate rounded bg-royal-soft px-1.5 py-0.5 text-[11px] font-medium text-royal-ink hover:underline" title={`${i.quantity} x ${i.productName}`}>{i.quantity} x {i.productName}</Link></li>
                  ))}
                  {c.its.length > 2 && <li className="px-1.5 text-[11px] text-muted">+ {c.its.length - 2} autre{c.its.length - 2 > 1 ? "s" : ""}</li>}
                  {c.bl.slice(0, 1).map((b) => <li key={b.id} className="truncate rounded bg-warn-soft px-1.5 py-0.5 text-[11px] text-ink" title={b.reason ?? "Blocage"}>Bloqué : {b.quantity} x {b.product.name}</li>)}
                  {c.off && <li className="text-[11px] font-medium text-danger">Indisponible</li>}
                </ul>
              </div>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-2 border-t border-line px-5 py-3 text-xs text-muted">
          <span className="inline-flex items-center gap-2"><span className="size-3 rounded bg-royal-soft" /> Réservation</span>
          <span className="inline-flex items-center gap-2"><span className="size-3 rounded bg-warn-soft" /> Blocage de stock</span>
          <span className="inline-flex items-center gap-2"><span className="size-3 rounded bg-danger-soft" /> Loueur indisponible</span>
        </div>
      </Card>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Périodes d'indisponibilité" description="Aucune nouvelle réservation sur ces dates" />
          {unavailabilities.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted">Aucune période à venir.</p>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {unavailabilities.map((u) => (
                <li key={u.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                  <div><p className="font-medium text-ink">Du {formatDate(u.startDate)} au {formatDate(u.endDate)}</p>{u.reason && <p className="text-xs text-muted">{u.reason}</p>}</div>
                  {canManage && <ActionButton endpoint={`/api/lenders/me/unavailabilities/${u.id}`} method="DELETE" label="Retirer" success="Indisponibilité retirée" confirm={{ title: "Retirer cette indisponibilité ?", description: "Les clients pourront de nouveau réserver sur ces dates." }} />}
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardHeader title="Blocages de stock" description="Quantités retirées de la location" />
          {blocks.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted">Aucun blocage ce mois-ci. Ajoutez-en depuis la page Stock.</p>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {blocks.map((b) => (
                <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                  <div><p className="font-medium text-ink">{b.quantity} x {b.product.name}</p><p className="text-xs text-muted">Du {formatDate(b.startDate)} au {formatDate(b.endDate)}{b.reason ? ` · ${b.reason}` : ""}</p></div>
                  {canManage && <ActionButton endpoint={`/api/products/${b.product.id}/availability?blockId=${b.id}`} method="DELETE" label="Lever" success="Blocage levé" />}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
