import type { Metadata } from "next";
import Link from "next/link";
import { pageAdmin } from "@/lib/auth/page";
import { formatDateTime } from "@/lib/dates";
import { formatFcfa } from "@/lib/money";
import { REFUND_STATUS } from "@/lib/labels";
import { listRefunds } from "@/services/admin";
import { PageHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";

export const metadata: Metadata = { title: "Remboursements", robots: { index: false } };

const KIND: Record<string, string> = { CANCELLATION: "Annulation", DISPUTE: "Litige", GOODWILL: "Geste commercial", MODIFICATION: "Modification", DEPOSIT_RELEASE: "Caution restituée" };

export default async function Page({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const actor = await pageAdmin("ADMIN_REFUNDS");
  const sp = await searchParams;
  const r = await listRefunds(actor, { page: Number(sp.page) || 1 });
  return (
    <>
      <PageHeader title="Remboursements" description="Chaque remboursement indique l'impact sur les loueurs : déduction du solde ou recouvrement si le versement a déjà eu lieu." />
      <DataTable
        rows={r.rows}
        rowKey={(f) => f.id}
        empty={{ title: "Aucun remboursement", description: "Les remboursements apparaissent ici dès la première annulation." }}
        columns={[
          { header: "Référence", cell: (f) => <span className="font-mono text-[13px]">{f.reference}</span> },
          { header: "Réservation", cell: (f) => <Link href={`/admin/reservations/${f.reservation.id}`} className="font-mono text-[13px] text-royal-ink hover:underline">{f.reservation.reference}</Link> },
          { header: "Nature", cell: (f) => KIND[f.kind] ?? f.kind },
          { header: "Motif", cell: (f) => <span className="block max-w-64 truncate" title={f.reason}>{f.reason}</span> },
          { header: "Montant", align: "right", cell: (f) => formatFcfa(f.amount) },
          { header: "Impact loueur", cell: (f) => (f.reimbursements.length ? f.reimbursements.map((x) => <Badge key={x.lenderId + x.impactedAmount} tone={x.status === "TO_RECOVER" ? "danger" : "neutral"}>{formatFcfa(x.impactedAmount)}{x.status === "TO_RECOVER" ? " à recouvrer" : ""}</Badge>) : "") },
          { header: "Date", cell: (f) => formatDateTime(f.createdAt) },
          { header: "Statut", cell: (f) => <StatusBadge entry={REFUND_STATUS[f.status]} /> },
        ]}
      />
      <Pagination page={r.page} totalPages={r.totalPages} basePath="/admin/remboursements" />
    </>
  );
}
