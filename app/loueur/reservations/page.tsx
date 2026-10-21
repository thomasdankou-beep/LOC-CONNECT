import type { Metadata } from "next";
import Link from "next/link";
import type { ReservationStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { pageLender } from "@/lib/auth/page";
import { formatDate, formatDateTime } from "@/lib/dates";
import { formatFcfa } from "@/lib/money";
import { MODIFICATION_STATUS, RESERVATION_STATUS } from "@/lib/labels";
import { listLenderReservations } from "@/services/reservations";
import { PageHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/badge";
import { Tabs } from "@/components/ui/misc";
import { Pagination } from "@/components/ui/pagination";
import { FilterBar } from "@/components/ui/filter-bar";

export const metadata: Metadata = { title: "Réservations", robots: { index: false } };

const TABS: { key: string; label: string; statuses?: ReservationStatus[] }[] = [
  { key: "all", label: "Toutes" },
  { key: "to_validate", label: "À valider", statuses: ["PAID"] },
  { key: "upcoming", label: "À préparer", statuses: ["CONFIRMED", "READY"] },
  { key: "active", label: "En cours", statuses: ["DELIVERING", "DELIVERED", "IN_USE", "RETURN_PENDING", "RETURNED", "DISPUTED"] },
  { key: "modifications", label: "Modifications" },
  { key: "done", label: "Terminées", statuses: ["COMPLETED"] },
  { key: "cancelled", label: "Annulées", statuses: ["CANCELLED", "REFUNDED"] },
];

export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string; page?: string }> }) {
  const actor = await pageLender("ORDER_VIEW");
  const sp = await searchParams;
  const tab = TABS.find((t) => t.key === sp.tab) ?? TABS[0];
  const lenderId = actor.lenderId;

  const [toValidate, modsPending] = await Promise.all([
    db.reservationItem.count({ where: { lenderId, status: "PAID" } }),
    db.modificationRequest.count({ where: { lenderId, status: "PENDING_VALIDATION" } }),
  ]);
  const tabItems = TABS.map((t) => ({ key: t.key, label: t.label, href: `/loueur/reservations?tab=${t.key}`, count: t.key === "to_validate" ? toValidate : t.key === "modifications" ? modsPending : undefined }));

  return (
    <>
      <PageHeader title="Réservations" description="Seules vos lignes de réservation sont visibles. Les autres loueurs d'une même commande ne sont jamais affichés." />
      <Tabs items={tabItems} active={tab.key} />

      {tab.key === "modifications" ? (
        <ModificationsList lenderId={lenderId} />
      ) : (
        <ReservationsTable lenderId={lenderId} tab={tab} q={sp.q} page={Number(sp.page) || 1} />
      )}
    </>
  );
}

async function ReservationsTable({ lenderId, tab, q, page }: { lenderId: string; tab: (typeof TABS)[number]; q?: string; page: number }) {
  const result = await listLenderReservations(lenderId, { status: tab.statuses, q, page });
  return (
    <>
      <FilterBar basePath="/loueur/reservations" q={q} placeholder="Référence, produit ou nom du client" extra={<input type="hidden" name="tab" value={tab.key} />} />
      <DataTable
        rows={result.rows}
        rowKey={(i) => i.id}
        empty={{ title: "Aucune réservation", description: "Les nouvelles réservations payées apparaissent ici." }}
        columns={[
          { header: "Référence", cell: (i) => <Link href={`/loueur/reservations/${i.reservation.id}`} className="font-mono text-[13px] font-medium text-royal-ink hover:underline">{i.reservation.reference}</Link> },
          { header: "Client", cell: (i) => `${i.reservation.client.firstName} ${i.reservation.client.lastName.slice(0, 1)}.` },
          { header: "Produit", cell: (i) => <span className="block max-w-56 truncate">{i.quantity} x {i.productName}</span> },
          { header: "Période", cell: (i) => <span className="whitespace-nowrap">{formatDate(i.startDate)} au {formatDate(i.endDate)}</span> },
          { header: "Mode", cell: (i) => (i.reservation.fulfillmentType === "DELIVERY" ? "Livraison" : "Retrait") },
          { header: "Montant", align: "right", cell: (i) => formatFcfa(i.subtotal) },
          { header: "Statut", cell: (i) => <StatusBadge entry={RESERVATION_STATUS[i.status]} /> },
        ]}
      />
      <Pagination page={result.page} totalPages={result.totalPages} basePath="/loueur/reservations" params={{ tab: tab.key, q }} />
    </>
  );
}

async function ModificationsList({ lenderId }: { lenderId: string }) {
  const mods = await db.modificationRequest.findMany({
    where: { lenderId, status: { in: ["PENDING_VALIDATION", "ACCEPTED", "PENDING_PAYMENT", "PAID"] } },
    include: { reservation: { select: { id: true, reference: true, client: { select: { firstName: true, lastName: true } } } }, lines: true },
    orderBy: { respondBy: "asc" },
  });
  return (
    <DataTable
      rows={mods}
      rowKey={(m) => m.id}
      empty={{ title: "Aucune demande de modification", description: "Les demandes des clients à valider sous 2 heures apparaissent ici." }}
      columns={[
        { header: "Réservation", cell: (m) => <Link href={`/loueur/reservations/${m.reservation.id}`} className="font-mono text-[13px] font-medium text-royal-ink hover:underline">{m.reservation.reference}</Link> },
        { header: "Client", cell: (m) => `${m.reservation.client.firstName} ${m.reservation.client.lastName.slice(0, 1)}.` },
        { header: "Changements", cell: (m) => `${m.lines.length} ligne${m.lines.length > 1 ? "s" : ""}` },
        { header: "Impact", align: "right", cell: (m) => (m.differenceToPay > 0 ? `+ ${formatFcfa(m.differenceToPay)}` : m.refundToIssue > 0 ? `- ${formatFcfa(m.refundToIssue)}` : "Aucun") },
        { header: "Réponse avant", cell: (m) => (m.status === "PENDING_VALIDATION" ? <span className={m.respondBy < new Date() ? "text-danger" : ""}>{formatDateTime(m.respondBy)}</span> : "") },
        { header: "Statut", cell: (m) => <StatusBadge entry={MODIFICATION_STATUS[m.status]} /> },
      ]}
    />
  );
}
