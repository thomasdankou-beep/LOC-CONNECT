"use client";

import { useState } from "react";
import { useAction } from "@/hooks/use-action";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { formatFcfa } from "@/lib/money";
import { cn } from "@/lib/cn";

export type PlanCard = {
  plan: "FREE" | "PRO" | "PREMIUM";
  label: string;
  price: number;
  ratePct: number;
  perks: string[];
  estimate: number;
  best: boolean;
  current: boolean;
  scheduled: boolean;
  /** Effet du choix : montant prélevé maintenant, ou date d'effet pour une formule moins chère. */
  quote: { immediate: boolean; feeNow: number; credit: number; firstMonthFree: boolean; effectiveAt: string | null };
};

/** Cartes des trois formules, avec confirmation qui annonce exactement ce qui sera prélevé et quand. */
export function PlanChooser({ cards, canChange, selfService }: { cards: PlanCard[]; canChange: boolean; selfService: boolean }) {
  const { run, pending } = useAction();
  const [confirm, setConfirm] = useState<PlanCard | null>(null);

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-3">
        {cards.map((c) => (
          <div key={c.plan} className={cn("flex flex-col rounded-card border bg-surface p-5 shadow-card", c.current ? "border-royal ring-1 ring-royal" : "border-line")}>
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-lg font-semibold text-ink">{c.label}</h3>
              {c.current ? <span className="rounded-full bg-royal px-2.5 py-0.5 text-xs font-medium text-white">Votre formule</span> : c.best ? <span className="rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-medium text-success">La plus avantageuse pour vous</span> : null}
            </div>
            <p className="mt-3 text-2xl font-semibold tabular-nums text-ink">{c.price === 0 ? "0 FCFA" : formatFcfa(c.price)} <span className="text-sm font-normal text-muted">/ mois</span></p>
            <p className="text-sm font-medium text-ink">Commission {c.ratePct} % par location</p>
            <ul className="mt-4 flex-1 space-y-1.5 text-sm text-muted">
              {c.perks.map((p) => <li key={p} className="flex gap-2"><span aria-hidden className="text-royal-ink">•</span>{p}</li>)}
            </ul>
            <p className="mt-4 rounded-control bg-surface-2/70 px-3 py-2 text-sm text-ink">Sur vos 30 derniers jours : <strong className="tabular-nums">{formatFcfa(c.estimate)}</strong></p>
            {c.scheduled && <p className="mt-2 text-sm text-warn">Prévue à l&apos;échéance de votre formule actuelle.</p>}
            {canChange && selfService && !c.current && !c.scheduled && (
              <Button className="mt-4" variant={c.best ? "primary" : "secondary"} onClick={() => setConfirm(c)}>Choisir {c.label}</Button>
            )}
            {canChange && selfService && c.current && cards.some((x) => x.scheduled) && (
              <Button className="mt-4" variant="secondary" loading={pending} onClick={() => run("/api/lenders/me/plan", { method: "PUT", body: { plan: c.plan } }, { success: "Changement annulé : vous gardez votre formule" })}>Garder {c.label}</Button>
            )}
          </div>
        ))}
      </div>
      <Modal open={confirm !== null} onClose={() => setConfirm(null)} title={confirm ? `Passer en formule ${confirm.label}` : ""}>
        {confirm && (
          <div className="space-y-4 text-sm">
            {confirm.quote.immediate ? (
              <p className="text-ink">
                Effet immédiat : vos nouvelles réservations seront à {confirm.ratePct} % de commission.{" "}
                {confirm.quote.firstMonthFree ? <strong>Votre premier mois est offert.</strong> : <>Montant déduit de votre prochain versement : <strong className="tabular-nums">{formatFcfa(confirm.quote.feeNow)}</strong>{confirm.quote.credit > 0 && <> ({formatFcfa(confirm.quote.credit)} déduits pour les jours non utilisés de votre formule actuelle)</>}.</>}{" "}
                Renouvellement automatique chaque mois, sans engagement.
              </p>
            ) : (
              <p className="text-ink">Votre formule actuelle reste active jusqu&apos;au {confirm.quote.effectiveAt ? new Date(confirm.quote.effectiveAt).toLocaleDateString("fr-FR") : "prochain renouvellement"}, puis vous passerez en formule {confirm.label}{confirm.price > 0 ? ` (${formatFcfa(confirm.price)} par mois)` : ""}. Rien n&apos;est prélevé aujourd&apos;hui.</p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setConfirm(null)}>Annuler</Button>
              <Button loading={pending} onClick={async () => { const r = await run("/api/lenders/me/plan", { method: "PUT", body: { plan: confirm.plan } }, { success: "Formule mise à jour" }); if (r !== undefined) setConfirm(null); }}>Confirmer</Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
