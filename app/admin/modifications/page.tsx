import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { can } from "@/lib/auth/actor";
import { pageAdmin } from "@/lib/auth/page";
import { formatDateTime } from "@/lib/dates";
import { formatFcfa } from "@/lib/money";
import { MODIFICATION_STATUS } from "@/lib/labels";
import { PageHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Tabs } from "@/components/ui/misc";
import { ModificationAdminActions } from "@/features/admin/reservation-actions";

export const metadata: Metadata = { title: "Modifications", robots: { index: false } };

export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const actor = await pageAdmin("ADMIN_MODIFICATIONS");
  const sp = await searchParams;
  const tab = sp.tab === "all" ? "all" : "escalated";
  const mods = await db.modificationRequest.findMany({
    where: tab === "escalated" ? { status: "PENDING_VALIDATION", escalatedAt: { not: null } } : {},
    include: { reservation: { select: { id: true, reference: true, client: { select: { firstName: true, lastName: true } } } }, lender: { select: { companyName: true } }, lines: true },
    orderBy: { requestedAt: "desc" },
    take: 60,
  });
  return (
    <>
      <PageHeader title="Modifications de réservation" description="Quand un loueur ne répond pas dans le délai, la demande est escaladée ici : relancez le loueur ou tranchez." />
      <Tabs active={tab} items={[{ key: "escalated", label: "Escaladées", href: "/admin/modifications" }, { key: "all", label: "Toutes", href: "/admin/modifications?tab=all" }]} />
      <DataTable
        rows={mods}
        rowKey={(m) => m.id}
        empty={{ title: tab === "escalated" ? "Aucune escalade" : "Aucune demande", description: "Tout est traité par les loueurs dans les délais." }}
        columns={[
          { header: "Réservation", cell: (m) => <Link href={`/admin/reservations/${m.reservation.id}`} className="font-mono text-[13px] font-medium text-royal-ink hover:underline">{m.reservation.reference}</Link> },
          { header: "Client", cell: (m) => `${m.reservation.client.firstName} ${m.reservation.client.lastName.slice(0, 1)}.` },
          { header: "Loueur", cell: (m) => m.lender.companyName },
          { header: "Impact", align: "right", cell: (m) => (m.differenceToPay > 0 ? `+ ${formatFcfa(m.differenceToPay)}` : m.refundToIssue > 0 ? `- ${formatFcfa(m.refundToIssue)}` : "Aucun") },
          { header: "Demandée le", cell: (m) => formatDateTime(m.requestedAt) },
          { header: "Statut", cell: (m) => <div className="flex flex-wrap items-center gap-1.5"><StatusBadge entry={MODIFICATION_STATUS[m.status]} />{m.escalatedAt && <Badge tone="danger">Escaladée</Badge>}</div> },
          { header: "Actions", cell: (m) => (m.status === "PENDING_VALIDATION" && can(actor, "ADMIN_MODIFICATIONS") ? <ModificationAdminActions reservationId={m.reservation.id} modificationId={m.id} /> : "") },
        ]}
      />
    </>
  );
}
