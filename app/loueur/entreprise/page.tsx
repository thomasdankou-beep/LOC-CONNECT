import type { Metadata } from "next";
import { db } from "@/lib/db";
import { can } from "@/lib/auth/actor";
import { pageLender } from "@/lib/auth/page";
import { formatDateTime, parseDate } from "@/lib/dates";
import { listLenderAudit, listMembers, listPermissions, listRoles } from "@/services/lenders";
import { PageHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { Tabs } from "@/components/ui/misc";
import { Pagination } from "@/components/ui/pagination";
import { CompanyForm } from "@/features/lender/company-form";
import { TeamPanel } from "@/features/lender/team-panel";
import { RolesPanel } from "@/features/lender/roles-panel";

export const metadata: Metadata = { title: "Mon entreprise", robots: { index: false } };

const OWNER_ONLY = new Set(["TEAM_MANAGE", "AUDIT_VIEW"]);

export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string; page?: string; action?: string; from?: string; to?: string }> }) {
  const actor = await pageLender();
  const sp = await searchParams;
  const canCompany = can(actor, "COMPANY_MANAGE");
  const canTeam = can(actor, "TEAM_MANAGE");
  const canAudit = can(actor, "AUDIT_VIEW");
  const tabs = [
    { key: "profil", label: "Profil", show: true },
    { key: "equipe", label: "Équipe", show: canTeam },
    { key: "roles", label: "Rôles", show: canTeam },
    { key: "audit", label: "Journal d'activité", show: canAudit },
  ].filter((t) => t.show);
  const tab = tabs.find((t) => t.key === sp.tab)?.key ?? "profil";

  return (
    <>
      <PageHeader title="Mon entreprise" description="Profil public, équipe, droits d'accès et journal des actions." />
      <Tabs items={tabs.map((t) => ({ key: t.key, label: t.label, href: `/loueur/entreprise?tab=${t.key}` }))} active={tab} />
      {tab === "profil" && <ProfileTab lenderId={actor.lenderId} canEdit={canCompany} />}
      {tab === "equipe" && <TeamTab actor={actor} />}
      {tab === "roles" && <RolesTab lenderId={actor.lenderId} />}
      {tab === "audit" && <AuditTab actor={actor} sp={sp} />}
    </>
  );
}

async function ProfileTab({ lenderId, canEdit }: { lenderId: string; canEdit: boolean }) {
  const l = await db.lender.findUniqueOrThrow({ where: { id: lenderId } });
  return <CompanyForm canEdit={canEdit} company={{ companyName: l.companyName, description: l.description ?? "", phone: l.phone ?? "", email: l.email ?? "", address: l.address ?? "", offersDelivery: l.offersDelivery, deliveryFeeLocal: l.deliveryFeeLocal, deliveryFeeRemote: l.deliveryFeeRemote }} />;
}

async function TeamTab({ actor }: { actor: Awaited<ReturnType<typeof pageLender>> }) {
  const [members, roles] = await Promise.all([listMembers(actor.lenderId), listRoles(actor.lenderId)]);
  return (
    <TeamPanel
      members={members.map((m) => ({ id: m.id, status: m.status, roleId: m.roleId, roleName: m.role.name, name: `${m.user.firstName} ${m.user.lastName}`, email: m.user.email, phone: m.user.phone, lastLoginAt: m.user.lastLoginAt?.toISOString() ?? null }))}
      roles={roles.map((r) => ({ id: r.id, name: r.name }))}
    />
  );
}

async function RolesTab({ lenderId }: { lenderId: string }) {
  const [roles, perms] = await Promise.all([listRoles(lenderId), listPermissions()]);
  return (
    <RolesPanel
      catalog={perms.filter((p) => !OWNER_ONLY.has(p.code)).map((p) => ({ code: p.code, label: p.label, domain: p.domain }))}
      roles={roles.map((r) => ({ id: r.id, name: r.name, description: r.description, isSystem: r.isSystem, members: r._count.members, permissions: r.permissions.map((p) => p.permission.code) }))}
    />
  );
}

async function AuditTab({ actor, sp }: { actor: Awaited<ReturnType<typeof pageLender>>; sp: { page?: string; action?: string; from?: string; to?: string } }) {
  const valid = (d?: string) => { try { if (d) parseDate(d); return d || undefined; } catch { return undefined; } };
  const result = await listLenderAudit(actor, { page: Number(sp.page) || 1, action: sp.action || undefined, from: valid(sp.from), to: valid(sp.to) });
  return (
    <>
      <form action="/loueur/entreprise" method="get" className="mb-5 flex flex-wrap items-end gap-3">
        <input type="hidden" name="tab" value="audit" />
        <label className="flex flex-col gap-1 text-sm text-muted">Action<input name="action" defaultValue={sp.action} placeholder="ex : stock" className="h-11 rounded-control border border-line bg-surface px-3 text-[15px] text-ink" /></label>
        <label className="flex flex-col gap-1 text-sm text-muted">Du<input type="date" name="from" defaultValue={sp.from} className="h-11 rounded-control border border-line bg-surface px-3 text-[15px] text-ink" /></label>
        <label className="flex flex-col gap-1 text-sm text-muted">Au<input type="date" name="to" defaultValue={sp.to} className="h-11 rounded-control border border-line bg-surface px-3 text-[15px] text-ink" /></label>
        <button type="submit" className="h-11 rounded-control bg-navy px-5 text-sm font-medium text-white hover:opacity-90">Filtrer</button>
      </form>
      <DataTable
        rows={result.rows}
        rowKey={(a) => a.id}
        empty={{ title: "Aucune action", description: "Les actions de votre équipe (qui, quoi, quand) sont journalisées ici." }}
        columns={[
          { header: "Date", cell: (a) => <span className="whitespace-nowrap">{formatDateTime(a.createdAt)}</span> },
          { header: "Utilisateur", cell: (a) => (a.user ? `${a.user.firstName} ${a.user.lastName}` : "Système") },
          { header: "Action", cell: (a) => <span className="font-mono text-[13px]">{a.action}</span> },
          { header: "Objet", cell: (a) => `${a.entity}${a.entityId ? ` · ${a.entityId.slice(-6)}` : ""}` },
        ]}
      />
      <Pagination page={result.page} totalPages={result.totalPages} basePath="/loueur/entreprise" params={{ tab: "audit", action: sp.action, from: sp.from, to: sp.to }} />
    </>
  );
}
