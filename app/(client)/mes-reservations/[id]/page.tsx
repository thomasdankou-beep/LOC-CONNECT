import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireClient } from "@/lib/auth/actor";
import { AppError } from "@/lib/errors";
import { formatDate, formatDateTime } from "@/lib/dates";
import { formatFcfa } from "@/lib/money";
import { CANCELLABLE_STATUSES, DISPUTABLE_STATUSES } from "@/lib/state-machine";
import { DELIVERY_STATUS, DEPOSIT_STATUS, EXTRA_CHARGE_STATUS, FULFILLMENT, MODIFICATION_STATUS, PAYMENT_METHOD, PAYMENT_STATUS, REFUND_STATUS, RESERVATION_STATUS, RETURN_CONDITION, RETURN_REPORT_STATUS, DISPUTE_STATUS, PAYMENT_MODE } from "@/lib/labels";
import { getReservationDetail } from "@/services/reservations";
import { Card, CardHeader } from "@/components/ui/card";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { DateText, Money } from "@/components/ui/misc";
import { Notice } from "@/components/ui/states";
import { Photo } from "@/components/ui/photo";
import { LinkButton } from "@/components/ui/button";
import { ActionButton } from "@/components/ui/action";
import { ArrowLeft, Phone, ShieldCheck, Truck, MapPin } from "@/components/ui/icons";
import { AuxPaymentButton } from "@/features/reservations/aux-payment";
import { CancelButton, DisputeButton, ModificationButton, ReturnReportActions, ReviewButton } from "@/features/reservations/client-actions";
import { nextActionForClient } from "@/features/reservations/helpers";
import { ClientCashBox } from "@/features/cash/cash-cards";
import { ReservationInvoicesCard } from "@/features/invoices/reservation-invoices-card";


export const metadata: Metadata = { title: "Détail de la réservation", robots: { index: false } };

export default async function ReservationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireClient();
  const result = await getReservationDetail(actor, id).catch((e) => {
    if (e instanceof AppError && (e.code === "NOT_FOUND" || e.code === "FORBIDDEN")) return null;
    throw e;
  });
  if (!result) notFound();
  const r = result.reservation;
  const refunds = r.refunds || [];

  const byLender = new Map<string, typeof r.items>();
  for (const i of r.items) byLender.set(i.lender.id, [...(byLender.get(i.lender.id) ?? []), i]);
  const lenderIds = [...byLender.keys()];
  const lenderProducts = await db.product.findMany({ where: { lenderId: { in: lenderIds }, status: "PUBLISHED", deletedAt: null }, select: { id: true, name: true, lenderId: true }, orderBy: { name: "asc" }, take: 80 });

  const cancellable = r.items.some((i) => CANCELLABLE_STATUSES.includes(i.status));
  const modifiable = r.items.some((i) => ["PAID", "CONFIRMED", "READY"].includes(i.status)) && !r.modifications.some((m) => ["PENDING_VALIDATION", "ACCEPTED", "PENDING_PAYMENT", "PAID"].includes(m.status));
  const disputable = r.items.some((i) => DISPUTABLE_STATUSES.includes(i.status));
  const hold = r.holdId && ["HOLD", "PENDING_PAYMENT"].includes(r.status) ? await db.hold.findFirst({ where: { id: r.holdId, status: "ACTIVE", expiresAt: { gt: new Date() } } }) : null;
  const initialPayment = r.payments.find((p) => p.kind === "INITIAL");
  const paidOnline = initialPayment ? ["PAID", "PARTIALLY_REFUNDED", "REFUNDED"].includes(initialPayment.status) : false;

  return (
    <>
      <Link href="/mes-reservations" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"><ArrowLeft size={16} /> Mes réservations</Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-mono text-2xl font-semibold text-ink sm:text-3xl">{r.reference}</h1>
            <StatusBadge entry={RESERVATION_STATUS[r.status]} />
            {initialPayment?.provider === "simulated" && <Badge tone="warning">Paiement simulé</Badge>}
          </div>
          <p className="mt-1 text-sm text-muted">Créée le {formatDate(r.createdAt)} · {FULFILLMENT[r.fulfillmentType]}{r.currentVersion > 1 ? ` · version ${r.currentVersion}` : ""}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {hold && <LinkButton href={`/paiement?hold=${hold.id}`}>Finaliser le paiement</LinkButton>}
          {modifiable && (
            <ModificationButton
              reservationId={r.id}
              items={r.items.filter((i) => ["PAID", "CONFIRMED", "READY"].includes(i.status)).map((i) => ({ id: i.id, name: i.productName, quantity: i.quantity, startDate: i.startDate.toISOString().slice(0, 10), endDate: i.endDate.toISOString().slice(0, 10), lenderId: i.lender.id, lenderName: i.lender.companyName }))}
              lenderProducts={lenderIds.map((lid) => ({ lenderId: lid, products: lenderProducts.filter((p) => p.lenderId === lid).map((p) => ({ id: p.id, name: p.name })) }))}
            />
          )}
          {cancellable && <CancelButton reservationId={r.id} />}
          {disputable && <DisputeButton reservationId={r.id} lenders={[...byLender.entries()].map(([lid, its]) => ({ id: lid, name: its[0].lender.companyName, items: its.filter((i) => DISPUTABLE_STATUSES.includes(i.status)).map((i) => ({ id: i.id, name: i.productName })) })).filter((l) => l.items.length > 0)} />}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          {[...byLender.entries()].map(([lenderId, items]) => {
            const lender = items[0].lender;
            const delivery = r.deliveries.find((d) => d.lenderId === lenderId);
            const cash = r.cashSettlements.find((c) => c.lenderId === lenderId && c.status !== "CANCELLED");
            return (
              <Card key={lenderId}>
                <CardHeader
                  title={<Link href={`/loueurs/${lender.slug}`} className="hover:underline">{lender.companyName}</Link>}
                  description={lender.phone ? <span className="inline-flex items-center gap-1.5"><Phone size={14} /> {lender.phone}</span> : undefined}
                  action={<Badge tone={items[0].paymentMode === "DEPOSIT_CASH" ? "warning" : "success"}>{PAYMENT_MODE[items[0].paymentMode].short}</Badge>}
                />
                <ul className="divide-y divide-line">
                  {items.map((i) => {
                    const report = i.returnReport;
                    const pendingExtra = i.extraCharges.filter((c) => c.status === "PENDING");
                    return (
                      <li key={i.id} className="p-5">
                        <div className="flex flex-col gap-4 sm:flex-row">
                          <Photo src={i.product.photos[0]?.url} alt="" w={240} h={180} className="aspect-[4/3] w-full shrink-0 rounded-control sm:w-32" />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <h3 className="font-semibold text-ink"><Link href={`/produits/${i.product.slug}`} className="hover:underline">{i.quantity} x {i.productName}</Link></h3>
                              <StatusBadge entry={RESERVATION_STATUS[i.status]} />
                            </div>
                            <p className="mt-1 text-sm text-muted">Du {formatDate(i.startDate)} au {formatDate(i.endDate)} ({i.days} jour{i.days > 1 ? "s" : ""}) · {formatFcfa(i.unitPrice)} par jour</p>
                            <p className="mt-0.5 text-sm font-medium tabular-nums text-ink">{formatFcfa(i.subtotal)}{i.cashDue > 0 && <span className="font-normal text-muted"> · acompte en ligne {formatFcfa(i.subtotal - i.cashDue)}, solde en espèces {formatFcfa(i.cashDue)}</span>}</p>
                            <p className="mt-1 text-sm text-royal-ink">{nextActionForClient(i.status, { fulfillment: r.fulfillmentType, extraChargePending: pendingExtra.length > 0, contestable: report?.status === "SUBMITTED" && Boolean(report.contestDeadline && report.contestDeadline > new Date()) })}</p>

                            {i.deposit && (
                              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-control bg-surface-2/60 px-3 py-2 text-sm">
                                <span className="flex items-center gap-1.5 font-medium text-ink"><ShieldCheck size={16} className="text-royal-ink" /> Caution {formatFcfa(i.deposit.amount)}</span>
                                <StatusBadge entry={DEPOSIT_STATUS[i.deposit.status]} />
                                {i.deposit.frozen && <Badge tone="danger">Gelée</Badge>}
                                {i.deposit.withheldAmount > 0 && <span className="text-muted">retenu {formatFcfa(i.deposit.withheldAmount)}</span>}
                                {i.deposit.releasedAmount > 0 && <span className="text-muted">restitué {formatFcfa(i.deposit.releasedAmount)}</span>}
                              </div>
                            )}

                            {report && (
                              <div className="mt-3 rounded-control border border-line p-3 text-sm">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <p className="font-medium text-ink">Constat de retour : {RETURN_CONDITION[report.condition]}</p>
                                  <StatusBadge entry={RETURN_REPORT_STATUS[report.status]} />
                                </div>
                                <p className="mt-1 text-muted">Retourné {report.returnedQuantity}, endommagé {report.damagedQuantity}, perdu {report.lostQuantity}{report.comment ? ` · ${report.comment}` : ""}</p>
                                {(report.withheldAmount > 0 || report.extraChargeAmount > 0) && <p className="mt-1 text-ink">Retenue : {formatFcfa(report.withheldAmount)}{report.extraChargeAmount > 0 ? ` · complément : ${formatFcfa(report.extraChargeAmount)}` : ""}</p>}
                                {report.photos.length > 0 && (
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    {report.photos.map((p) => (
                                      <a key={p.id} href={`/api/files/${p.storageKey}`} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-control border border-line">
                                        <Photo src={`/api/files/${p.storageKey}`} alt="Preuve de retour" w={160} h={120} className="size-16" />
                                      </a>
                                    ))}
                                  </div>
                                )}
                                {(report.damagedQuantity > 0 || report.lostQuantity > 0) && <Link href={`/factures/constat/${i.id}`} className="mt-2 inline-block font-medium text-royal-ink hover:underline">{report.settledAt ? "Facture de casse et perte" : "Voir le constat de casse et perte"}</Link>}
                                {report.status === "SUBMITTED" && report.contestDeadline && report.contestDeadline > new Date() && (
                                  <div className="mt-3"><ReturnReportActions itemId={i.id} deadline={report.contestDeadline.toISOString()} /></div>
                                )}
                              </div>
                            )}

                            {pendingExtra.map((c) => (
                              <div key={c.id} className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-control bg-danger-soft px-3 py-2.5 text-sm">
                                <div><p className="font-medium text-ink">Complément à régler : {formatFcfa(c.amount)}</p><p className="text-muted">{c.reason}</p></div>
                                <AuxPaymentButton label="Régler" title="Régler le complément" amount={c.amount} endpoint="/api/payments" body={{ extraChargeId: c.id }} />
                              </div>
                            ))}

                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              {i.status === "COMPLETED" && !i.review && <ReviewButton itemId={i.id} productName={i.productName} />}
                              {i.review && <Badge tone="success">Avis publié ({i.review.productRating}/5)</Badge>}
                              {CANCELLABLE_STATUSES.includes(i.status) && items.filter((x) => CANCELLABLE_STATUSES.includes(x.status)).length > 1 && <CancelButton reservationId={r.id} itemIds={[i.id]} label="Annuler cette ligne" />}
                            </div>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
                {cash && <ClientCashBox cash={cash} paid={paidOnline} />}
                {delivery && delivery.type === "DELIVERY" && (
                  <div className="border-t border-line bg-surface-2/40 px-5 py-4 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="flex items-center gap-2 font-medium text-ink"><Truck size={18} className="text-royal-ink" /> Livraison</p>
                      <StatusBadge entry={DELIVERY_STATUS[delivery.status]} />
                    </div>
                    <p className="mt-1 flex items-start gap-1.5 text-muted"><MapPin size={14} className="mt-0.5 shrink-0" /> {delivery.address}{delivery.zone ? `, ${delivery.zone}` : ""}</p>
                    <p className="mt-0.5 text-muted">{delivery.scheduledDate ? `Prévue le ${formatDate(delivery.scheduledDate)}` : "Date à planifier"}{delivery.slotStart ? ` entre ${delivery.slotStart} et ${delivery.slotEnd}` : ""} · frais {formatFcfa(delivery.fee)}</p>
                    {delivery.proofs.length > 0 && <p className="mt-1 text-muted">{delivery.proofs.length} preuve{delivery.proofs.length > 1 ? "s" : ""} de livraison enregistrée{delivery.proofs.length > 1 ? "s" : ""}.</p>}
                  </div>
                )}
              </Card>
            );
          })}

          {r.modifications.length > 0 && (
            <Card>
              <CardHeader title="Demandes de modification" description="Historique et état de chaque demande" />
              <ul className="divide-y divide-line">
                {r.modifications.map((m) => (
                  <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-sm">
                    <div>
                      <p className="font-medium text-ink">{formatDateTime(m.requestedAt)} · {m.lines.map((l) => `${l.action === "ADD" ? "Ajout" : l.action === "REMOVE" ? "Suppression" : "Changement"}`).join(", ")}</p>
                      <p className="text-muted">{m.differenceToPay > 0 ? `Complément ${formatFcfa(m.differenceToPay)}` : m.refundToIssue > 0 ? `Remboursement ${formatFcfa(m.refundToIssue)}` : "Sans impact financier"}{m.rejectionReason ? ` · ${m.rejectionReason}` : ""}{m.escalatedAt ? " · escaladée à l'administration" : ""}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge entry={MODIFICATION_STATUS[m.status]} />
                      {m.status === "PENDING_PAYMENT" && <AuxPaymentButton label="Régler le complément" title="Régler le complément de modification" amount={m.differenceToPay} endpoint={`/api/reservations/${r.id}/modifications/${m.id}/pay`} body={{}} />}
                      {["PENDING_VALIDATION", "ACCEPTED", "PENDING_PAYMENT"].includes(m.status) && <ActionButton endpoint={`/api/reservations/${r.id}/modifications/${m.id}/cancel`} label="Annuler la demande" confirm={{ title: "Annuler la demande de modification ?" }} success="Demande annulée" />}
                    </div>
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
                  <li key={d.id}><Link href={`/mes-litiges/${d.id}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-sm transition hover:bg-surface-2/50"><span><span className="font-mono">{d.reference}</span> · {d.reason}</span><StatusBadge entry={DISPUTE_STATUS[d.status]} /></Link></li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <aside className="space-y-6">
          <Card className="p-5">
            <h2 className="text-base font-semibold text-ink">Montants</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-muted">Locations</dt><dd><Money value={r.subtotal} /></dd></div>
              {r.deliveryFee > 0 && <div className="flex justify-between"><dt className="text-muted">Livraison</dt><dd><Money value={r.deliveryFee} /></dd></div>}
              <div className="flex justify-between"><dt className="text-muted">Cautions</dt><dd><Money value={r.depositTotal} /></dd></div>
              {r.cashTotal > 0 ? (
                <>
                  <div className="flex justify-between border-t border-line pt-2 text-base font-semibold"><dt>Payé en ligne</dt><dd><Money value={r.total} /></dd></div>
                  <div className="flex justify-between font-semibold"><dt>En espèces aux loueurs</dt><dd><Money value={r.cashTotal} /></dd></div>
                </>
              ) : (
                <div className="flex justify-between border-t border-line pt-2 text-base font-semibold"><dt>Total</dt><dd><Money value={r.total} /></dd></div>
              )}
            </dl>
          </Card>

          <ReservationInvoicesCard actor={actor} reservationId={r.id} />

          <Card className="p-5">
            <h2 className="text-base font-semibold text-ink">Paiements et remboursements</h2>
            <ul className="mt-3 space-y-3 text-sm">
              {r.payments.map((p) => (
                <li key={p.id} className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-ink">{p.kind === "INITIAL" ? "Paiement initial" : p.kind === "MODIFICATION" ? "Complément de modification" : "Complément de dommages"}</p>
                    <p className="text-xs text-muted">{PAYMENT_METHOD[p.method]} · {p.reference}</p>
                  </div>
                  <div className="text-right"><p className="tabular-nums text-ink">{formatFcfa(p.amount)}</p><StatusBadge entry={PAYMENT_STATUS[p.status]} /></div>
                </li>
              ))}
              {refunds.map((f) => (
                <li key={f.id} className="flex items-start justify-between gap-3">
                  <div><p className="font-medium text-ink">Remboursement</p><p className="text-xs text-muted">{f.reason}</p></div>
                  <div className="text-right"><p className="tabular-nums text-success">- {formatFcfa(f.amount)}</p><StatusBadge entry={REFUND_STATUS[f.status]} /></div>
                </li>
              ))}
              {r.payments.length === 0 && <li className="text-muted">Aucun paiement enregistré.</li>}
            </ul>
          </Card>

          <Card className="p-5">
            <h2 className="text-base font-semibold text-ink">Suivi</h2>
            <ol className="mt-4 space-y-4 border-l border-line pl-4">
              {r.history.filter((h) => !h.itemId).map((h) => (
                <li key={h.id} className="relative">
                  <span className="absolute -left-[1.4rem] top-1.5 size-2.5 rounded-full bg-royal" aria-hidden />
                  <p className="text-sm font-medium text-ink">{RESERVATION_STATUS[h.toStatus].label}</p>
                  <p className="text-xs text-muted"><DateText value={h.createdAt} />{h.note ? ` · ${h.note}` : ""}</p>
                </li>
              ))}
            </ol>
          </Card>
          {r.status === "CANCELLED" && r.cancellationReason && <Notice tone="info" title="Réservation annulée">{r.cancellationReason}</Notice>}
        </aside>
      </div>
    </>
  );
}
