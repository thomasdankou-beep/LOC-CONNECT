"use client";

import { useState } from "react";
import { useAction } from "@/hooks/use-action";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export type SettingRow = { key: string; group: string; label: string; description: string; type: "int" | "bool" | "string" | "enum"; options?: string[]; value: number | boolean | string; default: number | boolean | string };

const ENUM_LABELS: Record<string, string> = { PROPORTIONAL: "Remboursée au prorata", NON_REFUNDABLE: "Conservée par LOC'CONNECT" };

function Row({ s, canEdit }: { s: SettingRow; canEdit: boolean }) {
  const { run, pending } = useAction();
  const [value, setValue] = useState<string | boolean>(typeof s.value === "number" ? String(s.value) : s.value);
  const dirty = String(value) !== String(s.value);
  const isDefault = String(s.value) === String(s.default);

  async function save() {
    const payload = s.type === "int" ? Number(value) : value;
    await run("/api/admin/settings", { method: "PATCH", body: { key: s.key, value: payload } }, { success: "Paramètre enregistré" });
  }

  return (
    <li className="grid gap-3 px-5 py-4 lg:grid-cols-[1fr_20rem] lg:items-center">
      <div className="min-w-0">
        <p className="font-medium text-ink">{s.label} {!isDefault && <Badge tone="info">Personnalisé</Badge>}</p>
        <p className="mt-0.5 text-sm text-muted">{s.description}</p>
        <p className="mt-1 font-mono text-[12px] text-muted">{s.key} · défaut : {s.type === "bool" ? (s.default ? "oui" : "non") : String(s.default)}</p>
      </div>
      <div className="flex items-center gap-2">
        {s.type === "bool" ? (
          <label className="flex h-11 flex-1 cursor-pointer items-center gap-3 text-sm text-ink">
            <input type="checkbox" role="switch" checked={Boolean(value)} disabled={!canEdit} onChange={(e) => setValue(e.target.checked)} className="size-5 accent-[var(--lc-royal)]" />
            {value ? "Activé" : "Désactivé"}
          </label>
        ) : s.type === "enum" ? (
          <select value={String(value)} disabled={!canEdit} onChange={(e) => setValue(e.target.value)} aria-label={s.label} className="h-11 w-full min-w-0 flex-1 rounded-control border border-line bg-surface px-3 text-[15px] text-ink">
            {s.options?.map((o) => <option key={o} value={o}>{ENUM_LABELS[o] ?? o}</option>)}
          </select>
        ) : (
          <input type={s.type === "int" ? "number" : "text"} min={s.type === "int" ? 0 : undefined} value={String(value)} disabled={!canEdit} onChange={(e) => setValue(e.target.value)} aria-label={s.label} className="h-11 w-full min-w-0 flex-1 rounded-control border border-line bg-surface px-3 text-[15px] text-ink" />
        )}
        {canEdit && <Button size="md" variant={dirty ? "primary" : "secondary"} disabled={!dirty} loading={pending} onClick={save}>Enregistrer</Button>}
      </div>
    </li>
  );
}

export function SettingsEditor({ settings, canEdit }: { settings: SettingRow[]; canEdit: boolean }) {
  const groups = [...new Set(settings.map((s) => s.group))];
  return (
    <div className="space-y-6">
      {groups.map((g) => (
        <Card key={g}>
          <CardHeader title={g} />
          <ul className="divide-y divide-line">{settings.filter((s) => s.group === g).map((s) => <Row key={s.key} s={s} canEdit={canEdit} />)}</ul>
        </Card>
      ))}
    </div>
  );
}
