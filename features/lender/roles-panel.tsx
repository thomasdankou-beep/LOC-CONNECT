"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Checkbox, Input, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { Notice } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { Plus } from "@/components/ui/icons";

type Perm = { code: string; label: string; domain: string };
type Role = { id: string; name: string; description: string | null; isSystem: boolean; members: number; permissions: string[] };

export function RolesPanel({ roles, catalog }: { roles: Role[]; catalog: Perm[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [editing, setEditing] = useState<Role | "new" | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const domains = [...new Set(catalog.map((p) => p.domain))];

  function open(role: Role | "new") {
    setEditing(role);
    setSelected(new Set(role === "new" ? [] : role.permissions));
    setError(null);
  }
  const toggle = (code: string) => setSelected((s) => { const n = new Set(s); if (n.has(code)) n.delete(code); else n.add(code); return n; });

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const body = { name: String(fd.get("name")).trim(), description: String(fd.get("description") ?? "").trim() || undefined, permissions: [...selected] };
    setPending(true);
    setError(null);
    try {
      if (editing === "new") await api("/api/lenders/me/roles", { body });
      else if (editing) await api(`/api/lenders/me/roles/${editing.id}`, { method: "PATCH", body });
      toast({ tone: "success", title: editing === "new" ? "Rôle créé" : "Rôle mis à jour" });
      setEditing(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Une erreur est survenue.");
    } finally {
      setPending(false);
    }
  }

  const labelOf = (code: string) => catalog.find((p) => p.code === code)?.label ?? code;

  return (
    <Card>
      <CardHeader title="Rôles et permissions" description="Les rôles système sont modèles et en lecture seule. Créez des rôles sur mesure pour votre équipe." action={<Button size="sm" onClick={() => open("new")}><Plus size={16} /> Nouveau rôle</Button>} />
      <ul className="divide-y divide-line">
        {roles.map((r) => (
          <li key={r.id} className="px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-medium text-ink">{r.name} {r.isSystem ? <Badge>Rôle système</Badge> : <Badge tone="info">Personnalisé</Badge>}</p>
                {r.description && <p className="text-sm text-muted">{r.description}</p>}
                <p className="mt-1 text-xs text-muted">{r.members} membre{r.members > 1 ? "s" : ""} · {r.permissions.length} permission{r.permissions.length > 1 ? "s" : ""}</p>
              </div>
              {!r.isSystem && <Button variant="secondary" size="sm" onClick={() => open(r)}>Modifier</Button>}
            </div>
            <details className="mt-2 text-sm">
              <summary className="cursor-pointer text-royal-ink">Voir les permissions</summary>
              <ul className="mt-2 flex flex-wrap gap-1.5">{r.permissions.map((p) => <li key={p}><Badge>{labelOf(p)}</Badge></li>)}</ul>
            </details>
          </li>
        ))}
      </ul>

      <Modal open={editing !== null} onClose={() => setEditing(null)} size="lg" title={editing === "new" ? "Nouveau rôle" : "Modifier le rôle"} description="Cochez les actions autorisées. Elles sont contrôlées côté serveur sur chaque opération.">
        {editing && (
          <form key={editing === "new" ? "new" : editing.id} onSubmit={save} className="flex flex-col gap-4">
            <Input label="Nom du rôle" name="name" required minLength={3} defaultValue={editing === "new" ? "" : editing.name} />
            <Textarea label="Description" name="description" rows={2} defaultValue={editing === "new" ? "" : (editing.description ?? "")} />
            <div className="space-y-4">
              {domains.map((d) => (
                <fieldset key={d} className="rounded-control border border-line p-3">
                  <legend className="px-1 text-sm font-semibold text-ink">{d}</legend>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {catalog.filter((p) => p.domain === d).map((p) => <Checkbox key={p.code} label={p.label} checked={selected.has(p.code)} onChange={() => toggle(p.code)} />)}
                  </div>
                </fieldset>
              ))}
            </div>
            {error && <Notice tone="danger">{error}</Notice>}
            <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setEditing(null)}>Annuler</Button><Button type="submit" loading={pending} disabled={selected.size === 0}>Enregistrer</Button></div>
          </form>
        )}
      </Modal>
    </Card>
  );
}
