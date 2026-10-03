import type { Metadata } from "next";
import { db } from "@/lib/db";
import { pageAdmin } from "@/lib/auth/page";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { listPlatformRoles } from "@/services/admin";
import { Card, CardHeader, PageHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AssignRole, RevokeRole } from "@/features/admin/role-actions";

export const metadata: Metadata = { title: "Rôles et accès", robots: { index: false } };

export default async function Page() {
  const actor = await pageAdmin("ADMIN_ROLES");
  const [roles, admins] = await Promise.all([listPlatformRoles(actor), db.user.findMany({ where: { accountType: "ADMIN", status: "ACTIVE" }, select: { id: true, firstName: true, lastName: true }, orderBy: { firstName: "asc" } })]);
  const labelOf = (code: string) => PERMISSIONS.find((p) => p.code === code)?.label ?? code;
  return (
    <>
      <PageHeader title="Rôles et accès" description="Rôles de l'équipe LOC'CONNECT. Les permissions sont vérifiées côté serveur sur chaque page, chaque action et chaque API." actions={<AssignRole roles={roles.map((r) => ({ code: r.code, name: r.name }))} admins={admins.map((a) => ({ id: a.id, name: `${a.firstName} ${a.lastName}` }))} />} />
      <div className="space-y-4">
        {roles.map((r) => (
          <Card key={r.id}>
            <CardHeader title={r.name} description={r.description ?? undefined} action={<Badge tone="info">{r.permissions.length} permission{r.permissions.length > 1 ? "s" : ""}</Badge>} />
            <div className="space-y-4 p-5">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Membres</p>
                {r.users.length === 0 ? <p className="text-sm text-muted">Aucun membre.</p> : (
                  <ul className="divide-y divide-line rounded-control border border-line text-sm">
                    {r.users.map((u) => (
                      <li key={u.userId} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"><span className="text-ink">{u.user.firstName} {u.user.lastName} <span className="text-muted">· {u.user.email}</span></span>{u.userId !== actor.userId && <RevokeRole userId={u.userId} role={r.code} name={`${u.user.firstName} ${u.user.lastName}`} />}</li>
                    ))}
                  </ul>
                )}
              </div>
              <details>
                <summary className="cursor-pointer text-sm text-royal-ink">Voir les permissions</summary>
                <ul className="mt-2 flex flex-wrap gap-1.5">{r.permissions.map((p) => <li key={p.permission.code}><Badge>{labelOf(p.permission.code)}</Badge></li>)}</ul>
              </details>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
