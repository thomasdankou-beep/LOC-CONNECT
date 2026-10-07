import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { pageAdmin } from "@/lib/auth/page";
import { can } from "@/lib/auth/actor";
import { AppError } from "@/lib/errors";
import { formatDate, formatDateTime } from "@/lib/dates";
import { formatFcfa } from "@/lib/money";
import { CANCELLABLE_STATUSES } from "@/lib/state-machine";
import { DELIVERY_STATUS, DEPOSIT_STATUS, DISPUTE_STATUS, FULFILLMENT, MODIFICATION_STATUS, PAYMENT_METHOD, PAYMENT_STATUS, REFUND_STATUS, RESERVATION_STATUS, RETURN_REPORT_STATUS, CASH_STATUS, PAYMENT_MODE } from "@/lib/labels";
import { getReservationDetail } from "@/services/reservations";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { DateText, Money } from "@/components/ui/misc";
import { Photo } from "@/components/ui/photo";
import { ArrowLeft, Truck } from "@/components/ui/icons";
import { CancelButton } from "@/features/reservations/client-actions";
import { AdminRefund, ModificationAdminActions, StatusCorrection } from "@/features/admin/reservation-actions";
import { AdminCashActions } from "@/features/cash/cash-cards";
import { ReservationInvoicesCard } from "@/features/invoices/reservation-invoices-card";

export const metadata: Metadata = { title: "Réservation", robots: { index: false } };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await pageAdmin("ADMIN_RESERVATIONS");
  const result = await getReservationDetail(actor, id).catch((e) => {
    if (e instanceof AppError && (e.code === "NOT_FOUND" || e.code === "FORBIDDEN")) return null;
    throw e;
  });
  if (!result) notFound();
  const r = result.reservation;
  const byLender = new Map<string, typeof r.items>();
  for (const i of r.items) byLender.set(i.lender.id, [...(byLender.get(i.lender.id) ?? []), i]);
  const lenders = [...byLender.entries()].map(([lid, its]) => ({ id: lid, name: its[0].lender.companyName }));
  const cancellable = r.items.some((i) => CANCELLABLE_STATUSES.includes(i.status));
  const canRefund = can(actor, "ADMIN_REFUNDS");

  return (
    <>
      <Link href="/admin/reservations" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"><ArrowLeft size={16} /> Réservations</Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-mono text-2xl font-semibold text-ink sm:text-3xl">{r.reference}</h1>
            <StatusBadge entry={RESERVATION_STATUS[r.status]} />
          </div>
          <p className="mt-1 text-sm text-muted">{r.client.firstName} {r.client.lastName} · {r.client.email}{r.client.phone ? ` · ${r.client.phone}` : ""} · créée le {formatDate(r.createdAt)} · {FULFILLMENT[r.fulfillmentType]}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusCorrection reservationId={r.id} items={r.items.map((i) => ({ id: i.id, name: `${i.quantity} x ${i.productName}` }))} />
          {cancellable && <CancelButton reservationId={r.id} />}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          {[...byLender.entries()].map(([lenderId, items]) => {
            const delivery = r.deliveries.find((d) => d.lenderId === lenderId);
            const cash = r.cashSettlements.find((c) => c.lenderId === lenderId);
            return (
              <Card key={lenderId}>
                <CardHeader title={items[0].lender.companyName} description={items[0].lender.phone ?? undefined} action={<Badge tone={items[0].paymentMode === "DEPOSIT_CASH" ? "warning" : "neutral"}>{PAYMENT_MODE[items[0].paymentMode].short}</Badge>} />
                <ul className="divide-y divide-line">
                  {items.map((i) => (
                    <li key={i.id} className="flex flex-col gap-4 p-5 sm:flex-row">
                      <Photo src={i.product.photos[0]?.url} alt="" w={240} h={180} className="aspect-[4/3] w-full shrink-0 rounded-control sm:w-28" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <p className="font-semibold text-ink">{i.quantity} x {i.productName}</p>
                          <StatusBadge entry={RESERVATION_STATUS[i.status]} />
                        </div>
                        <p className="mt-1 text-sm text-muted">Du {formatDate(i.startDate)} au {formatDate(i.endDate)} · {formatFcfa(i.subtotal)} dont commission {formatFcfa(i.commission)}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                          {i.deposit && <span className="inline-flex items-center gap-2 rounded-control bg-surface-2/60 px-2.5 py-1">Caution {formatFcfa(i.deposit.amount)} <StatusBadge entry={DEPOSIT_STATUS[i.deposit.status]} />{i.deposit.frozen && <Badge tone="danger">Gelée</Badge>}</span>}
                          {i.returnReport && <span className="inline-flex items-center gap-2 rounded-control bg-surface-2/60 px-2.5 py-1">Constat : retenue {formatFcfa(i.returnReport.withheldAmount)} <StatusBadge entry={RETURN_REPORT_STATUS[i.returnReport.status]} /></span>}
                          {i.returnReport && (i.returnReport.damagedQuantity > 0 || i.returnReport.lostQuantity > 0) && <Link href={`/factures/constat/${i.id}`} className="font-medium text-royal-ink hover:underline">Constat de casse et perte</Link>}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
                {cash && (
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-warn-soft/40 px-5 py-3 text-sm">
                    <span className="text-ink">
                      Solde en espèces : <strong className="tabular-nums">{formatFcfa(cash.amountDue)}</strong>
                      {cash.deliveryDue > 0 && <span className="text-muted"> (dont livraison {formatFcfa(cash.deliveryDue)})</span>}
                      {typeof cash.code === "string" && cash.status === "PENDING" && <span className="text-muted"> · code {cash.code}</span>}
                      {cash.failedAttempts > 0 && <span className="text-muted"> · {cash.failedAttempts} code(s) erroné(s)</span>}
                      {cash.note && <span className="block text-muted">{cash.note}</span>}
                    </span>
                    <span className="flex items-center gap-2"><StatusBadge entry={CASH_STATUS[cash.status]} />{can(actor, "ADMIN_PAYMENTS") && <AdminCashActions cash={cash} />}</span>
                  </div>
                )}
                {delivery?.type === "DELIVERY" && (
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-surface-2/40 px-5 py-3 text-sm">
                    <span className="flex items-center gap-2 text-ink"><Truck size={16} className="text-royal-ink" /> {delivery.address}{delivery.zone ? `, ${delivery.zone}` : ""}</span>
                    <StatusBadge entry={DELIVERY_STATUS[delivery.status]} />
                  </div>
                )}
              </Card>
            );
          })}

          {r.modifications.length > 0 && (
            <Card>
              <CardHeader title="Demandes de modification" />
              <ul className="divide-y divide-line">
                {r.modifications.map((m) => (
                  <li key={m.id} className="space-y-3 px-5 py-4 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-medium text-ink">{formatDateTime(m.requestedAt)} · {m.lines.length} ligne{m.lines.length > 1 ? "s" : ""}</p>
                        <p className="text-muted">{m.differenceToPay > 0 ? `Complément ${formatFcfa(m.differenceToPay)}` : m.refundToIssue > 0 ? `Remboursement ${formatFcfa(m.refundToIssue)}` : "Sans impact financier"}{m.escalationNote ? ` · ${m.escalationNote}` : ""}{m.rejectionReason ? ` · ${m.rejectionReason}` : ""}</p>
                      </div>
                      <div className="flex items-center gap-2">{m.escalatedAt && <Badge tone="danger">Escaladée</Badge>}<StatusBadge entry={MODIFICATION_STATUS[m.status]} /></div>
                    </div>
                    {m.status === "PENDING_VALIDATION" && can(actor, "ADMIN_MODIFICATIONS") && <ModificationAdminActions reservationId={r.id} modificationId={m.id} />}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {r.disputes.length > 0 && (
            <Card>
              <CardHeader title="Litiges" />
              <ul className="divide-y divide-line">
                {r.disputes.map((d) => <li key={d.id}><Link href={`/admin/litiges/${d.id}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-sm hover:bg-surface-2/50"><span><span className="font-mono">{d.reference}</span> · {d.reason}</span><StatusBadge entry={DISPUTE_STATUS[d.status]} /></Link></li>)}
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
              <div className="flex justify-between"><dt className="text-muted">Commission</dt><dd><Money value={r.commissionTotal} /></dd></div>
              <div className="flex justify-between border-t border-line pt-2 text-base font-semibold"><dt>{r.cashTotal > 0 ? "Payé en ligne" : "Total payé"}</dt><dd><Money value={r.total} /></dd></div>
              {r.cashTotal > 0 && <div className="flex justify-between font-semibold"><dt>En espèces aux loueurs</dt><dd><Money value={r.cashTotal} /></dd></div>}
            </dl>
          </Card>
          <ReservationInvoicesCard actor={actor} reservationId={r.id} />
          <Card className="p-5">
            <h2 className="text-base font-semibold text-ink">Paiements</h2>
            <ul className="mt-3 space-y-4 text-sm">
              {r.payments.map((p) => (
                <li key={p.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div><p className="font-medium text-ink">{p.kind === "INITIAL" ? "Paiement initial" : p.kind === "MODIFICATION" ? "Modification" : "Dommages"}</p><p className="text-xs text-muted">{PAYMENT_METHOD[p.method]} · {p.provider} · {p.reference}</p></div>
                    <div className="text-right"><p className="tabular-nums text-ink">{formatFcfa(p.amount)}</p><StatusBadge entry={PAYMENT_STATUS[p.status]} /></div>
                  </div>
                  {canRefund && ["PAID", "PARTIALLY_REFUNDED"].includes(p.status) && <div className="mt-2"><AdminRefund paymentId={p.id} max={p.amount} lenders={lenders} /></div>}
                </li>
              ))}
              {(r.refunds ?? []).map((f) => <li key={f.id} className="flex items-start justify-between gap-3"><div><p className="font-medium text-ink">Remboursement</p><p className="text-xs text-muted">{f.reason}</p></div><div className="text-right"><p className="tabular-nums text-success">- {formatFcfa(f.amount)}</p><StatusBadge entry={REFUND_STATUS[f.status]} /></div></li>)}
              {r.payments.length === 0 && <li className="text-muted">Aucun paiement.</li>}
            </ul>
          </Card>
          <Card className="p-5">
            <h2 className="text-base font-semibold text-ink">Historique</h2>
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
