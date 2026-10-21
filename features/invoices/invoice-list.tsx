import Link from "next/link";
import type { Actor } from "@/lib/auth/actor";
import { formatDate } from "@/lib/dates";
import { formatFcfa } from "@/lib/money";
import { INVOICE_TITLE, listInvoices } from "@/services/invoices";
import { DataTable } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";
import { FilterBar } from "@/components/ui/filter-bar";

const KIND_TONE = { RENTAL: "info", DAMAGE: "warning", CREDIT_NOTE: "neutral", SUBSCRIPTION: "success" } as const;

/** Liste des factures et avoirs selon le périmètre de l'acteur, avec recherche et filtre par type. */
export async function InvoiceList({ actor, basePath, sp }: { actor: Actor; basePath: string; sp: { q?: string; status?: string; page?: string } }) {
  // Le filtre par type passe par le champ « status » de la barre de filtre.
  const kind = sp.status === "RENTAL" || sp.status === "DAMAGE" || sp.status === "CREDIT_NOTE" || sp.status === "SUBSCRIPTION" ? sp.status : undefined;
  const r = await listInvoices(actor, { q: sp.q || undefined, kind, page: Number(sp.page) || 1 });
  return (
    <>
      <FilterBar basePath={basePath} q={sp.q} status={sp.status} statuses={Object.entries(INVOICE_TITLE).map(([value, label]) => ({ value, label }))} placeholder="N° de facture, réservation ou loueur" />
      <DataTable
        rows={r.rows}
        rowKey={(i) => i.id}
        empty={{ title: "Aucune facture", description: "Les factures sont émises à la confirmation du paiement, les avoirs lors d'une annulation ou d'un remboursement." }}
        columns={[
          { header: "N°", cell: (i) => <Link href={`/factures/${i.id}`} className="font-mono text-[13px] font-medium text-royal-ink hover:underline">{i.number}</Link> },
          { header: "Type", cell: (i) => <Badge tone={KIND_TONE[i.kind]}>{INVOICE_TITLE[i.kind]}</Badge> },
          { header: "Réservation", cell: (i) => i.reservation ? <span className="font-mono text-[13px]">{i.reservation.reference}</span> : <span className="text-muted">Abonnement</span> },
          ...(actor.accountType === "LENDER" ? [] : [{ header: "Loueur", cell: (i: (typeof r.rows)[number]) => i.lender.companyName }]),
          { header: "Date", cell: (i) => formatDate(i.issuedAt) },
          { header: "Montant TTC", align: "right" as const, cell: (i) => <span className="tabular-nums">{i.kind === "CREDIT_NOTE" ? "- " : ""}{formatFcfa(i.totalTtc)}</span> },
          { header: "", cell: (i) => <Link href={`/factures/${i.id}`} className="text-sm font-medium text-royal-ink hover:underline">Voir et imprimer</Link> },
        ]}
      />
      <Pagination page={r.page} totalPages={r.totalPages} basePath={basePath} params={{ q: sp.q, status: sp.status }} />
    </>
  );
}
