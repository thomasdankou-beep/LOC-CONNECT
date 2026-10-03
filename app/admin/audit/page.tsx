import type { Metadata } from "next";
import { pageAdmin } from "@/lib/auth/page";
import { formatDateTime } from "@/lib/dates";
import { listAudit } from "@/services/admin";
import { PageHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";
import { FilterBar } from "@/components/ui/filter-bar";

export const metadata: Metadata = { title: "Journal d'audit", robots: { index: false } };

const ENTITIES = ["Reservation", "Payment", "Refund", "Product", "Lender", "User", "Dispute", "ReturnReport", "Payout", "Setting", "Category", "City", "Delivery", "ModificationRequest"];

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string; entity?: string; page?: string }> }) {
  const actor = await pageAdmin("ADMIN_AUDIT");
  const sp = await searchParams;
  const r = await listAudit(actor, { q: sp.q, entity: sp.entity || undefined, page: Number(sp.page) || 1 });
  return (
    <>
      <PageHeader title="Journal d'audit" description="Qui a fait quoi, quand, avec l'ancienne et la nouvelle valeur. Le journal n'est jamais modifié ni supprimé." />
      <FilterBar basePath="/admin/audit" q={sp.q} placeholder="Action (ex : refund, setting)" extra={<select name="entity" defaultValue={sp.entity ?? ""} aria-label="Objet" className="h-11 rounded-control border border-line bg-surface px-3 text-[15px] text-ink"><option value="">Tous les objets</option>{ENTITIES.map((e) => <option key={e} value={e}>{e}</option>)}</select>} />
      <DataTable
        rows={r.rows}
        rowKey={(a) => a.id}
        empty={{ title: "Aucune entrée", description: "Aucune action ne correspond à ces filtres." }}
        columns={[
          { header: "Date", cell: (a) => <span className="whitespace-nowrap">{formatDateTime(a.createdAt)}</span> },
          { header: "Utilisateur", cell: (a) => (a.user ? <span>{a.user.firstName} {a.user.lastName} <Badge>{a.user.accountType === "ADMIN" ? "Admin" : a.user.accountType === "LENDER" ? "Loueur" : "Client"}</Badge></span> : "Système") },
          { header: "Action", cell: (a) => <span className="font-mono text-[13px]">{a.action}</span> },
          { header: "Objet", cell: (a) => `${a.entity}${a.entityId ? ` · ${a.entityId.slice(-6)}` : ""}` },
          { header: "Détail", cell: (a) => <span className="block max-w-72 truncate font-mono text-[12px] text-muted" title={JSON.stringify(a.newValue ?? "")}>{a.newValue ? JSON.stringify(a.newValue) : ""}</span> },
          { header: "IP", cell: (a) => <span className="font-mono text-[12px] text-muted">{a.ip ?? ""}</span> },
        ]}
      />
      <Pagination page={r.page} totalPages={r.totalPages} basePath="/admin/audit" params={{ q: sp.q, entity: sp.entity }} />
    </>
  );
}
