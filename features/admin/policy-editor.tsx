"use client";

import { useState } from "react";
import { useAction } from "@/hooks/use-action";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Notice } from "@/components/ui/states";
import { Plus, Trash } from "@/components/ui/icons";

type Rule = { minHoursBefore: number; refundPercent: number };

/** Éditeur de paliers : « au moins X heures avant le début : Y % remboursé ». En deçà du dernier palier, rien n'est remboursé. */
export function PolicyEditor({ initial, canEdit }: { initial: Rule[]; canEdit: boolean }) {
  const { run, pending, error } = useAction();
  const [rules, setRules] = useState<Rule[]>(initial);
  const sorted = [...rules].sort((a, b) => b.minHoursBefore - a.minHoursBefore);
  const update = (i: number, patch: Partial<Rule>) => setRules((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  return (
    <Card>
      <CardHeader title="Paliers de remboursement" description="Évalués du délai le plus long au plus court. La caution est toujours restituée en intégralité." />
      <div className="space-y-3 p-5">
        {rules.length === 0 && <p className="text-sm text-muted">Aucun palier : aucune location n&apos;est remboursée en cas d&apos;annulation.</p>}
        {rules.map((r, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-end gap-3">
            <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">Au moins (heures avant le début)<input type="number" min={0} value={r.minHoursBefore} disabled={!canEdit} onChange={(e) => update(i, { minHoursBefore: Math.max(0, Number(e.target.value) || 0) })} className="h-11 rounded-control border border-line bg-surface px-3 text-[15px] font-normal text-ink" /></label>
            <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">Remboursé (%)<input type="number" min={0} max={100} value={r.refundPercent} disabled={!canEdit} onChange={(e) => update(i, { refundPercent: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })} className="h-11 rounded-control border border-line bg-surface px-3 text-[15px] font-normal text-ink" /></label>
            {canEdit && <button type="button" onClick={() => setRules((x) => x.filter((_, j) => j !== i))} aria-label={`Supprimer le palier ${i + 1}`} className="flex size-11 items-center justify-center rounded-control border border-line text-danger hover:bg-danger-soft"><Trash size={18} /></button>}
          </div>
        ))}
        {canEdit && (
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Button variant="secondary" onClick={() => setRules((r) => [...r, { minHoursBefore: 0, refundPercent: 0 }])}><Plus size={16} /> Ajouter un palier</Button>
            <Button loading={pending} onClick={() => run("/api/admin/cancellation-policy", { method: "PUT", body: { rules } }, { success: "Politique enregistrée", silentError: true })}>Enregistrer</Button>
          </div>
        )}
        {error && <Notice tone="danger">{error.details?.[0]?.message ?? error.message}</Notice>}
      </div>
      <div className="border-t border-line bg-surface-2/40 p-5">
        <p className="text-sm font-medium text-ink">Aperçu pour le client</p>
        <ul className="mt-2 space-y-1 text-sm text-muted">
          {sorted.map((r, i) => <li key={i}>Au moins {r.minHoursBefore} h avant le début : {r.refundPercent} % de la location remboursés</li>)}
          <li>{sorted.length ? `Moins de ${sorted[sorted.length - 1].minHoursBefore} h avant le début : aucun remboursement de la location` : "Aucun remboursement de la location"}</li>
        </ul>
      </div>
    </Card>
  );
}
