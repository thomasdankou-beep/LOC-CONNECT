import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { pageActor } from "@/lib/auth/page";
import { AppError } from "@/lib/errors";
import { formatDate, formatDateTime, formatRentalPeriod } from "@/lib/dates";
import { readHandover, readReturnCheck, returnCheckLabels } from "@/lib/material-check";
import { RESERVATION_STATUS, RETURN_REPORT_STATUS } from "@/lib/labels";
import { getReservationDetail } from "@/services/reservations";
import { scheduleOf } from "@/services/invoices";
import { PrintButton } from "@/features/invoices/print-button";
import { reservationHref } from "@/features/invoices/helpers";
import { operationalDocuments } from "@/features/invoices/operational-documents";

export const metadata: Metadata = { title: "Bon de location", robots: { index: false } };

export default async function Page({ params }: { params: Promise<{ id: string; lenderId: string; kind: string }> }) {
  const { id, lenderId, kind } = await params;
  if (kind !== "preparation" && kind !== "remise" && kind !== "retour") notFound();
  const actor = await pageActor(`/bons/${id}/${lenderId}/${kind}`);
  const { reservation } = await getReservationDetail(actor, id).catch((error) => {
    if (error instanceof AppError && (error.code === "NOT_FOUND" || error.code === "FORBIDDEN")) notFound();
    throw error;
  });
  const documents = operationalDocuments(actor, reservation, lenderId);
  const title = documents?.titles[kind];
  if (!documents || !title) notFound();

  const { items, pickup, plan } = documents;
  const lender = items[0].lender;
  const delivery = pickup ? undefined : reservation.deliveries.find((entry) => entry.lenderId === lenderId);
  const schedule = scheduleOf(items, plan.deliverySlot ?? null, plan.returnSlot ?? null, delivery);
  const outDate = plan.confirmedPickupDate ?? schedule.outDate;
  const backDate = plan.confirmedDepotReturnDate ?? schedule.backDate;
  const place = pickup ? lender.address : delivery?.address ?? reservation.deliveryAddress;
  const cell = "border-b border-line px-2 py-3 align-top";
  const columns = kind === "preparation" ? ["Prévus", "Statut", "Préparés"]
    : kind === "remise" ? ["Prévus", "Remis", "État et réserves"]
    : ["Loués", "Rendus", "Cassés", "Manquants", "Observations"];

  return (
    <div className="mx-auto max-w-4xl px-4 print:max-w-none print:px-0">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={reservationHref(actor, id)} className="text-sm font-medium text-royal-ink hover:underline">Retour à la réservation</Link>
        <PrintButton label="Imprimer ou enregistrer en PDF" />
      </div>
      <article className="rounded-card bg-surface p-5 text-ink shadow-card sm:p-8 print:rounded-none print:p-0 print:shadow-none">
        <header className="border-b border-line pb-5">
          <p className="text-sm font-semibold text-muted">{lender.companyName} · LOC CONNECT</p>
          <h1 className="mt-2 text-2xl font-bold">{title}</h1>
          <p className="mt-1 text-sm">Réservation <span className="font-mono">{reservation.reference}</span></p>
          <p className="mt-1 text-xs text-muted">Version {reservation.currentVersion}</p>
        </header>
        <dl className="my-5 grid gap-4 text-sm sm:grid-cols-2">
          <div><dt className="font-semibold">Client</dt><dd>{reservation.client.firstName} {reservation.client.lastName}{reservation.contactPhone || reservation.client.phone ? ` · ${reservation.contactPhone || reservation.client.phone}` : ""}</dd></div>
          {reservation.eventName && <div><dt className="font-semibold">Événement</dt><dd>{reservation.eventName}</dd></div>}
          <div><dt className="font-semibold">{pickup ? "Dépôt" : "Lieu de livraison"}</dt><dd>{place || "À préciser"}</dd></div>
          <div><dt className="font-semibold">{pickup ? "Retrait" : "Livraison"} prévue</dt><dd>{formatDate(outDate)}{schedule.outSlot && ` · ${schedule.outSlot}`}</dd></div>
          <div><dt className="font-semibold">{pickup ? "Retour" : "Récupération"} prévue</dt><dd>{formatDate(backDate)}{schedule.backSlot && ` · ${schedule.backSlot}`}</dd></div>
        </dl>
        {kind === "remise" && <p className="mb-3 text-sm text-muted">{delivery?.deliveredAt ? `Livraison enregistrée le ${formatDateTime(delivery.deliveredAt)}. ` : ""}Le tableau reprend les contrôles de remise enregistrés par le loueur.</p>}
        <div className="overflow-x-auto print:overflow-visible">
          <table className="w-full text-left text-sm print:text-xs">
            <thead className="bg-surface-2"><tr><th scope="col" className={cell}>Matériel</th>{columns.map((column) => <th scope="col" className={cell} key={column}>{column}</th>)}</tr></thead>
            <tbody>
              {items.map((item) => {
                const report = item.returnReport;
                const handover = readHandover(item.handoverCheck);
                const material = readReturnCheck(report?.materialCheck);
                return (
                  <tr key={item.id} className="break-inside-avoid">
                    <th scope="row" className={cell}><span className="font-medium">{item.productName}</span><span className="block text-xs font-normal text-muted">{formatRentalPeriod(item.startDate, item.endDate)}</span></th>
                    <td className={cell}>{kind === "retour" ? report?.rentedQuantity ?? item.quantity : item.quantity}</td>
                    {kind === "preparation" && <><td className={cell}>{RESERVATION_STATUS[item.status].label}</td><td className={cell}>☐</td></>}
                    {kind === "remise" && (handover ? <>
                      <td className={cell}>{handover.quantity}</td>
                      <td className={`${cell} break-words`}>
                        <p>{handover.condition === "GOOD" ? "Bon état" : "Avec réserves"}</p>
                        <p>Réception par {handover.recipient} · {formatDateTime(handover.recordedAt)}</p>
                        {handover.packaging && <p>Emballages remis · {handover.packaging}</p>}
                        {handover.accessories && <p>Accessoires remis · {handover.accessories}</p>}
                        {handover.notes && <p className="whitespace-pre-wrap">{handover.notes}</p>}
                      </td>
                    </> : <td className={cell} colSpan={2}>Contrôle non enregistré</td>)}
                    {kind === "retour" && (report ? <>
                      <td className={cell}>{report.returnedQuantity}</td>
                      <td className={cell}>{report.damagedQuantity}</td>
                      <td className={cell}>{report.lostQuantity}</td>
                      <td className={`${cell} break-words`}>
                        {RETURN_REPORT_STATUS[report.status].label}
                        {handover && <p>Quantité remise · {handover.quantity}</p>}
                        {report.comment && <p className="whitespace-pre-wrap">{report.comment}</p>}
                        {material && <>
                          <p>Emballages · {returnCheckLabels[material.packaging]}</p>
                          <p>Accessoires · {returnCheckLabels[material.accessories]}</p>
                          {material.notes && <p className="whitespace-pre-wrap">{material.notes}</p>}
                        </>}
                      </td>
                    </> : <td className={cell} colSpan={4}>Constat en attente</td>)}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {kind !== "retour" && (
          <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
            <div className="min-h-20 rounded-control border border-line p-3">{kind === "preparation" ? "Gestionnaire de stock" : "Client"}<p className="text-xs text-muted">Nom et signature</p></div>
            <div className="min-h-20 rounded-control border border-line p-3">{kind === "preparation" ? "Responsable de la commande" : "Loueur"}<p className="text-xs text-muted">Nom et signature</p></div>
          </div>
        )}
      </article>
    </div>
  );
}
