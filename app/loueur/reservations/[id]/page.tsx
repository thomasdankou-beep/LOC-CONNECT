import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { can } from "@/lib/auth/actor";
import { getSettings } from "@/lib/settings";
import { pageLender } from "@/lib/auth/page";
import { AppError } from "@/lib/errors";
import { formatDate, formatDateTime } from "@/lib/dates";
import { formatFcfa } from "@/lib/money";
import { DELIVERY_STATUS, DEPOSIT_STATUS, DISPUTE_STATUS, FULFILLMENT, MODIFICATION_STATUS, RESERVATION_STATUS, RETURN_CONDITION, RETURN_REPORT_STATUS } from "@/lib/labels";
import { getReservationDetail } from "@/services/reservations";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { DateText, Money } from "@/components/ui/misc";
import { Notice } from "@/components/ui/states";
import { Photo } from "@/components/ui/photo";
import { LinkButton } from "@/components/ui/button";
import { ArrowLeft, MapPin, Phone, ShieldCheck, Truck } from "@/components/ui/icons";
import { AdvanceButton, ModificationDecision } from "@/features/lender/reservation-actions";
import { nextLenderTarget } from "@/features/lender/helpers";

export const metadata: Metadata = { title: "Détail de la réservation", robots: { index: false } };

const ACTION_LABEL = { ADD: "Ajout", UPDATE: "Changement", REMOVE: "Suppression" } as const;

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await pageLender("ORDER_VIEW");
  const result = await getReservationDetail(actor, id).catch((e) => {
    if (e instanceof AppError && (e.code === "NOT_FOUND" || e.code === "FORBIDDEN")) return null;
    throw e;
  });
  if (!result) notFound();
  const r = result.reservation;
  const freezeHours = (await getSettings())["payout.freeze_hours"];
  const perms = { validate: can(actor, "ORDER_VALIDATE"), prepare: can(actor, "ORDER_PREPARE"), handover: can(actor, "ORDER_STATUS_UPDATE") };
  const canDecide = can(actor, "MODIFICATION_DECIDE");
  const mine = r.items;
  const lenderTotal = mine.reduce((a, i) => a + i.subtotal, 0);
  const commission = mine.reduce((a, i) => a + i.commission, 0);
  const delivery = r.deliveries[0];

  const groups = (["PAID", "CONFIRMED", "READY"] as const).map((s) => ({ status: s, items: mine.filter((i) => i.status === s) })).filter((g) => g.items.length > 0);

  return (
    <>
      <Link href="/loueur/reservations" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"><ArrowLeft size={16} /> Réservations</Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-mono text-2xl font-semibold text-ink sm:text-3xl">{r.reference}</h1>
            <StatusBadge entry={RESERVATION_STATUS[r.status]} />
          </div>
          <p className="mt-1 text-sm text-muted">Créée le {formatDate(r.createdAt)} · {FULFILLMENT[r.fulfillmentType]}{r.currentVersion > 1 ? ` · version ${r.currentVersion}` : ""}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {groups.map((g) => {
            const to = nextLenderTarget(g.status, r.fulfillmentType, perms);
            return to ? <AdvanceButton key={g.status} reservationId={r.id} itemIds={g.items.map((i) => i.id)} to={to} /> : null;
          })}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          {r.modifications.filter((m) => m.status === "PENDING_VALIDATION").map((m) => (
            <Card key={m.id} className="border-warning/40">
              <CardHeader title="Demande de modification à traiter" description={`À traiter avant le ${formatDateTime(m.respondBy)}, sinon elle est transmise à l'administration.`} action={<StatusBadge entry={MODIFICATION_STATUS[m.status]} />} />
              <div className="space-y-3 p-5 text-sm">
                <ul className="divide-y divide-line rounded-control border border-line">
                  {m.lines.map((l) => (
                    <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
                      <div>
                        <p className="font-medium text-ink">{ACTION_LABEL[l.action]}</p>
                        <p className="text-xs text-muted">
                          {l.action !== "ADD" && l.startBefore && l.endBefore ? `Avant : ${l.quantityBefore} x, du ${formatDate(l.startBefore)} au ${formatDate(l.endBefore)}` : ""}
                          {l.action === "UPDATE" ? " · " : ""}
                          {l.action !== "REMOVE" && l.startAfter && l.endAfter ? `Après : ${l.quantityRequested} x, du ${formatDate(l.startAfter)} au ${formatDate(l.endAfter)}` : ""}
                        </p>
                      </div>
                      <p className="tabular-nums text-ink">{formatFcfa(l.subtotalBefore)} vers {formatFcfa(l.subtotalAfter)}</p>
                    </li>
                  ))}
                </ul>
                {m.reason && <p className="text-muted">Motif du client : {m.reason}</p>}
                <p className="text-ink">{m.differenceToPay > 0 ? `Le client réglera un complément de ${formatFcfa(m.differenceToPay)}.` : m.refundToIssue > 0 ? `Le client sera remboursé de ${formatFcfa(m.refundToIssue)}.` : "Sans impact financier."}</p>
                {canDecide ? <ModificationDecision reservationId={r.id} modificationId={m.id} /> : <Notice tone="info">Votre rôle ne permet pas de répondre aux demandes de modification.</Notice>}
              </div>
            </Card>
          ))}

          <Card>
            <CardHeader title="Articles de la commande" description="Uniquement les lignes qui vous concernent" />
            <ul className="divide-y divide-line">
              {mine.map((i) => {
                const report = i.returnReport;
                const to = nextLenderTarget(i.status, r.fulfillmentType, perms);
                return (
                  <li key={i.id} className="p-5">
                    <div className="flex flex-col gap-4 sm:flex-row">
                      <Photo src={i.product.photos[0]?.url} alt="" w={240} h={180} className="aspect-[4/3] w-full shrink-0 rounded-control sm:w-32" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <h3 className="font-semibold text-ink">{i.quantity} x {i.productName}</h3>
                          <StatusBadge entry={RESERVATION_STATUS[i.status]} />
                        </div>
                        <p className="mt-1 text-sm text-muted">Du {formatDate(i.startDate)} au {formatDate(i.endDate)} ({i.days} jour{i.days > 1 ? "s" : ""}) · {formatFcfa(i.unitPrice)} par jour</p>
                        <p className="mt-0.5 text-sm text-ink"><span className="font-medium tabular-nums">{formatFcfa(i.subtotal)}</span> <span className="text-muted">dont commission {formatFcfa(i.commission)}</span></p>
                        {i.deposit && (
                          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-control bg-surface-2/60 px-3 py-2 text-sm">
                            <span className="flex items-center gap-1.5 font-medium text-ink"><ShieldCheck size={16} className="text-royal-ink" /> Caution {formatFcfa(i.deposit.amount)}</span>
                            <StatusBadge entry={DEPOSIT_STATUS[i.deposit.status]} />
                            {i.deposit.frozen && <Badge tone="danger">Gelée</Badge>}
                          </div>
                        )}
                        {report && (
                          <div className="mt-3 rounded-control border border-line p-3 text-sm">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="font-medium text-ink">Constat : {RETURN_CONDITION[report.condition]}</p>
                              <StatusBadge entry={RETURN_REPORT_STATUS[report.status]} />
                            </div>
                            <p className="mt-1 text-muted">Retourné {report.returnedQuantity}, endommagé {report.damagedQuantity}, perdu {report.lostQuantity}{report.comment ? ` · ${report.comment}` : ""}</p>
                            {report.status === "SUBMITTED" && report.contestDeadline && <p className="mt-1 text-muted">Le client peut contester jusqu&apos;au {formatDateTime(report.contestDeadline)}.</p>}
                          </div>
                        )}
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          {to && <AdvanceButton reservationId={r.id} itemIds={[i.id]} to={to} />}
                          {["IN_USE", "RETURN_PENDING"].includes(i.status) && !report && can(actor, "RETURN_CREATE") && <LinkButton href={`/loueur/retours?item=${i.id}`} size="sm">Constater le retour</LinkButton>}
                          {i.review && <Badge tone="success">Avis {i.review.productRating}/5</Badge>}
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
            {delivery && delivery.type === "DELIVERY" && (
              <div className="border-t border-line bg-surface-2/40 px-5 py-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="flex items-center gap-2 font-medium text-ink"><Truck size={18} className="text-royal-ink" /> Livraison</p>
                  <div className="flex items-center gap-3"><StatusBadge entry={DELIVERY_STATUS[delivery.status]} />{can(actor, "DELIVERY_VIEW") && <Link href="/loueur/livraisons" className="font-medium text-royal-ink hover:underline">Gérer</Link>}</div>
                </div>
                <p className="mt-1 flex items-start gap-1.5 text-muted"><MapPin size={14} className="mt-0.5 shrink-0" /> {delivery.address}{delivery.zone ? `, ${delivery.zone}` : ""}</p>
                <p className="mt-0.5 text-muted">{delivery.scheduledDate ? `Prévue le ${formatDate(delivery.scheduledDate)}` : "Date à planifier"}{delivery.slotStart ? ` entre ${delivery.slotStart} et ${delivery.slotEnd}` : ""} · frais {formatFcfa(delivery.fee)}</p>
              </div>
            )}
          </Card>

          {r.modifications.filter((m) => m.status !== "PENDING_VALIDATION").length > 0 && (
            <Card>
              <CardHeader title="Historique des modifications" />
              <ul className="divide-y divide-line">
                {r.modifications.filter((m) => m.status !== "PENDING_VALIDATION").map((m) => (
                  <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-sm">
                    <div>
                      <p className="font-medium text-ink">{formatDateTime(m.requestedAt)}</p>
                      <p className="text-muted">{m.differenceToPay > 0 ? `Complément ${formatFcfa(m.differenceToPay)}` : m.refundToIssue > 0 ? `Remboursement ${formatFcfa(m.refundToIssue)}` : "Sans impact financier"}{m.rejectionReason ? ` · ${m.rejectionReason}` : ""}</p>
                    </div>
                    <StatusBadge entry={MODIFICATION_STATUS[m.status]} />
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {r.disputes.length > 0 && (
            <Card>
              <CardHeader title="Litiges" />
              <ul className="divide-y divide-line">
                {r.disputes.map((d) => (
                  <li key={d.id}><Link href={`/loueur/litiges/${d.id}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-sm transition hover:bg-surface-2/50"><span><span className="font-mono">{d.reference}</span> · {d.reason}</span><StatusBadge entry={DISPUTE_STATUS[d.status]} /></Link></li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <aside className="space-y-6">
          <Card className="p-5">
            <h2 className="text-base font-semibold text-ink">Client</h2>
            <p className="mt-2 text-sm font-medium text-ink">{r.client.firstName} {r.client.lastName}</p>
            {r.client.phone && <a href={`tel:${r.client.phone}`} className="mt-1 inline-flex items-center gap-1.5 text-sm text-royal-ink hover:underline"><Phone size={14} /> {r.client.phone}</a>}
          </Card>
          <Card className="p-5">
            <h2 className="text-base font-semibold text-ink">Vos montants</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-muted">Locations</dt><dd><Money value={lenderTotal} /></dd></div>
              <div className="flex justify-between"><dt className="text-muted">Commission LOC&apos;CONNECT</dt><dd><Money value={-commission} /></dd></div>
              {delivery && delivery.fee > 0 && <div className="flex justify-between"><dt className="text-muted">Livraison</dt><dd><Money value={delivery.fee} /></dd></div>}
              <div className="flex justify-between border-t border-line pt-2 font-semibold"><dt>Part nette</dt><dd><Money value={lenderTotal - commission + (delivery?.fee ?? 0)} /></dd></div>
            </dl>
            <p className="mt-3 text-xs text-muted">Versée {freezeHours} h après la fin de la location, sauf litige ou contestation.</p>
          </Card>
          <Card className="p-5">
            <h2 className="text-base font-semibold text-ink">Suivi</h2>
            <ol className="mt-4 space-y-4 border-l border-line pl-4">
              {r.history.map((h) => (
                <li key={h.id} className="relative">
                  <span className="absolute -left-[1.4rem] top-1.5 size-2.5 rounded-full bg-royal" aria-hidden />
                  <p className="text-sm font-medium text-ink">{RESERVATION_STATUS[h.toStatus].label}</p>
                  <p className="text-xs text-muted"><DateText value={h.createdAt} />{h.note ? ` · ${h.note}` : ""}</p>
                </li>
              ))}
            </ol>
          </Card>
        </aside>
      </div>
    </>
  );
}
