import type { Metadata } from "next";
import Link from "next/link";
import { requireClient } from "@/lib/auth/actor";
import { formatDate } from "@/lib/dates";
import { formatFcfa } from "@/lib/money";
import { PAYMENT_METHOD, PAYMENT_STATUS } from "@/lib/labels";
import { listClientPayments } from "@/services/payments";
import { PageHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";

export const metadata: Metadata = { title: "Mes paiements", robots: { index: false } };

export default async function Page({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const actor = await requireClient();
  const page = Math.max(1, Number((await searchParams).page) || 1);
  const result = await listClientPayments(actor.userId, page);
  const kind = { INITIAL: "Paiement initial", MODIFICATION: "Modification", EXTRA_CHARGE: "Complément de dommages" } as const;
  return (
    <>
      <PageHeader title="Mes paiements" description="Un paiement unique par commande, même avec plusieurs loueurs." />
      <DataTable
        rows={result.rows}
        rowKey={(p) => p.id}
        empty={{ title: "Aucun paiement", description: "Vos paiements apparaîtront après votre première réservation." }}
        columns={[
          { header: "Date", cell: (p) => formatDate(p.createdAt) },
          { header: "Référence", cell: (p) => <span className="font-mono text-sm">{p.reference}</span> },
          { header: "Réservation", cell: (p) => <Link href={`/mes-reservations/${p.reservation.id}`} className="font-mono text-royal-ink hover:underline">{p.reservation.reference}</Link> },
          { header: "Type", cell: (p) => kind[p.kind] },
          { header: "Moyen", cell: (p) => <span>{PAYMENT_METHOD[p.method]} {p.provider === "simulated" && <Badge tone="warning">simulé</Badge>}</span> },
          { header: "Montant", align: "right", cell: (p) => formatFcfa(p.amount) },
          { header: "Statut", cell: (p) => <StatusBadge entry={PAYMENT_STATUS[p.status]} /> },
        ]}
      />
      <Pagination page={result.page} totalPages={result.totalPages} basePath="/mes-paiements" />
    </>
  );
}
