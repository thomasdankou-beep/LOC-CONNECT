"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api-client";
import { useAction } from "@/hooks/use-action";
import { formatDateTime } from "@/lib/dates";
import { ActionButton } from "@/components/ui/action";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { Notice } from "@/components/ui/states";
import { Avatar } from "@/components/ui/misc";
import { Plus } from "@/components/ui/icons";

type Member = { id: string; status: "ACTIVE" | "SUSPENDED" | "DEACTIVATED"; roleId: string; roleName: string; name: string; email: string; phone: string | null; lastLoginAt: string | null };
type Role = { id: string; name: string };

const STATUS = { ACTIVE: { label: "Actif", tone: "success" }, SUSPENDED: { label: "Suspendu", tone: "warning" }, DEACTIVATED: { label: "Désactivé", tone: "neutral" } } as const;

export function TeamPanel({ members, roles }: { members: Member[]; roles: Role[] }) {
  const router = useRouter();
  const { run } = useAction();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [password, setPassword] = useState<{ email: string; value: string } | null>(null);

  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email")).trim();
    setPending(true);
    setError(null);
    try {
      const res = await api<{ temporaryPassword: string }>("/api/lenders/me/users", { body: { email, firstName: String(fd.get("firstName")), lastName: String(fd.get("lastName")), phone: String(fd.get("phone") ?? "") || undefined, roleId: String(fd.get("roleId")) } });
      setOpen(false);
      setPassword({ email, value: res.temporaryPassword });
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError("Une erreur est survenue.", "INTERNAL_ERROR", 500));
    } finally {
      setPending(false);
    }
  }
  const fe = (n: string) => error?.details?.find((d) => d.path === n)?.message;

  return (
    <Card>
      <CardHeader title="Sous-comptes" description="Vos collaborateurs n'accèdent qu'à votre entreprise, avec les droits de leur rôle." action={<Button size="sm" onClick={() => setOpen(true)}><Plus size={16} /> Ajouter</Button>} />
      <ul className="divide-y divide-line">
        {members.map((m) => (
          <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
            <div className="flex min-w-0 items-center gap-3">
              <Avatar name={m.name} size={40} />
              <div className="min-w-0">
                <p className="truncate font-medium text-ink">{m.name} <Badge tone={STATUS[m.status].tone}>{STATUS[m.status].label}</Badge></p>
                <p className="truncate text-sm text-muted">{m.email}{m.lastLoginAt ? ` · dernière connexion ${formatDateTime(m.lastLoginAt)}` : " · jamais connecté"}</p>
              </div>
            </div>
            {m.status !== "DEACTIVATED" && (
              <div className="flex flex-wrap items-center gap-2">
                <select aria-label={`Rôle de ${m.name}`} defaultValue={m.roleId} onChange={(e) => run(`/api/lenders/me/users/${m.id}`, { method: "PATCH", body: { roleId: e.target.value } }, { success: "Rôle mis à jour" })} className="h-10 rounded-control border border-line bg-surface px-3 text-sm text-ink">
                  {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
                <Button variant="secondary" size="sm" onClick={() => run(`/api/lenders/me/users/${m.id}`, { method: "PATCH", body: { status: m.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE" } }, { success: m.status === "ACTIVE" ? "Sous-compte suspendu" : "Sous-compte réactivé" })}>{m.status === "ACTIVE" ? "Suspendre" : "Réactiver"}</Button>
                <ActionButton endpoint={`/api/lenders/me/users/${m.id}/disable`} label="Désactiver" variant="ghost" className="text-danger" success="Sous-compte désactivé" confirm={{ title: `Désactiver ${m.name} ?`, description: "Ses sessions sont fermées immédiatement. Son historique d'actions est conservé.", confirmLabel: "Désactiver" }} />
              </div>
            )}
          </li>
        ))}
        {members.length === 0 && <li className="p-8 text-center text-sm text-muted">Aucun sous-compte. Ajoutez un collaborateur pour déléguer le stock, les livraisons ou la comptabilité.</li>}
      </ul>

      <Modal open={open} onClose={() => setOpen(false)} title="Ajouter un sous-compte" description="Un mot de passe provisoire est généré et affiché une seule fois.">
        <form onSubmit={create} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Prénom" name="firstName" required error={fe("firstName")} />
            <Input label="Nom" name="lastName" required error={fe("lastName")} />
          </div>
          <Input label="Adresse e-mail" name="email" type="email" required error={fe("email")} />
          <Input label="Téléphone" name="phone" type="tel" error={fe("phone")} />
          <Select label="Rôle" name="roleId" required error={fe("roleId")}>
            {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </Select>
          {error && !error.details?.length && <Notice tone="danger">{error.message}</Notice>}
          <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setOpen(false)}>Annuler</Button><Button type="submit" loading={pending}>Créer le sous-compte</Button></div>
        </form>
      </Modal>

      <Modal open={Boolean(password)} onClose={() => setPassword(null)} title="Sous-compte créé" size="sm" footer={<Button onClick={() => setPassword(null)}>J&apos;ai noté le mot de passe</Button>}>
        <p className="text-sm text-muted">Transmettez ces identifiants au collaborateur. Le mot de passe provisoire ne sera plus affiché.</p>
        <dl className="mt-4 space-y-2 rounded-control bg-surface-2/60 p-4 text-sm">
          <div className="flex justify-between gap-3"><dt className="text-muted">E-mail</dt><dd className="break-all font-medium text-ink">{password?.email}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-muted">Mot de passe</dt><dd className="font-mono font-medium text-ink">{password?.value}</dd></div>
        </dl>
      </Modal>
    </Card>
  );
}
