import type { Metadata } from "next";
import { pageAdmin } from "@/lib/auth/page";
import { formatDate, formatDateTime } from "@/lib/dates";
import { USER_STATUS } from "@/lib/labels";
import { listUsers } from "@/services/admin";
import { PageHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";
import { FilterBar } from "@/components/ui/filter-bar";
import { UserActions } from "@/features/admin/moderation-actions";

export const metadata: Metadata = { title: "Utilisateurs", robots: { index: false } };

const TYPE = { CLIENT: "Client", LENDER: "Loueur", ADMIN: "Administrateur" } as const;

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string; type?: string; status?: string; page?: string }> }) {
  const actor = await pageAdmin("ADMIN_USERS");
  const sp = await searchParams;
  const r = await listUsers(actor, { q: sp.q, type: sp.type, status: sp.status, page: Number(sp.page) || 1 });
  return (
    <>
      <PageHeader title="Utilisateurs" description={`${r.total} compte${r.total > 1 ? "s" : ""} : clients, loueurs, sous-comptes et administrateurs.`} />
      <FilterBar
        basePath="/admin/utilisateurs"
        q={sp.q}
        status={sp.status}
        statuses={Object.entries(USER_STATUS).map(([value, e]) => ({ value, label: e.label }))}
        placeholder="Nom ou adresse e-mail"
        extra={<select name="type" defaultValue={sp.type ?? ""} aria-label="Type de compte" className="h-11 rounded-control border border-line bg-surface px-3 text-[15px] text-ink"><option value="">Tous les types</option>{Object.entries(TYPE).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>}
      />
      <DataTable
        rows={r.rows}
        rowKey={(u) => u.id}
        empty={{ title: "Aucun utilisateur", description: "Modifiez les filtres pour élargir la recherche." }}
        columns={[
          { header: "Utilisateur", cell: (u) => <span className="block"><span className="block font-medium text-ink">{u.firstName} {u.lastName}</span><span className="block text-xs text-muted">{u.email}</span></span> },
          { header: "Type", cell: (u) => <span className="block"><Badge tone={u.accountType === "ADMIN" ? "info" : "neutral"}>{TYPE[u.accountType]}</Badge>{(u.ownedLender?.companyName ?? u.lenderMembership?.lender.companyName) && <span className="mt-1 block text-xs text-muted">{u.ownedLender?.companyName ?? u.lenderMembership?.lender.companyName}</span>}</span> },
          { header: "Rôles", cell: (u) => (u.roles.length ? u.roles.map((x) => x.role.name).join(", ") : "") },
          { header: "Inscrit le", cell: (u) => formatDate(u.createdAt) },
          { header: "Dernière connexion", cell: (u) => (u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "Jamais") },
          { header: "Statut", cell: (u) => <StatusBadge entry={USER_STATUS[u.status]} /> },
          { header: "Action", cell: (u) => <UserActions id={u.id} status={u.status} self={u.id === actor.userId} /> },
        ]}
      />
      <Pagination page={r.page} totalPages={r.totalPages} basePath="/admin/utilisateurs" params={{ q: sp.q, type: sp.type, status: sp.status }} />
    </>
  );
}
