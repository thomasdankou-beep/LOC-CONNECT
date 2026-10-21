"use client";

import { ActionButton, FormAction } from "@/components/ui/action";

import type { LenderTarget as Target } from "./helpers";

const LABEL: Record<Target, { label: string; success: string; variant: "primary" | "secondary" }> = {
  CONFIRMED: { label: "Confirmer", success: "Ligne confirmée", variant: "primary" },
  READY: { label: "Marquer comme prête", success: "Ligne prête", variant: "primary" },
  IN_USE: { label: "Remettre au client", success: "Matériel remis au client", variant: "primary" },
};

export function AdvanceButton({ reservationId, itemIds, to }: { reservationId: string; itemIds: string[]; to: Target }) {
  const t = LABEL[to];
  return <ActionButton endpoint={`/api/reservations/${reservationId}`} method="PATCH" body={{ status: to, itemIds }} label={t.label} variant={t.variant} success={t.success} />;
}

export function ModificationDecision({ reservationId, modificationId }: { reservationId: string; modificationId: string }) {
  const base = `/api/reservations/${reservationId}/modifications/${modificationId}`;
  return (
    <div className="flex flex-wrap gap-2">
      <ActionButton endpoint={`${base}/approve`} label="Accepter la modification" variant="primary" success="Modification acceptée" confirm={{ title: "Accepter cette modification ?", description: "Le client sera invité à régler le complément éventuel, puis la réservation sera mise à jour.", confirmLabel: "Accepter" }} />
      <FormAction endpoint={`${base}/reject`} label="Refuser" title="Refuser la modification" description="Le client est informé du motif. Sa réservation d'origine reste inchangée." fields={[{ name: "reason", label: "Motif du refus", type: "textarea", required: true, placeholder: "Ex : matériel déjà réservé sur ces dates" }]} submitLabel="Refuser" success="Modification refusée" />
    </div>
  );
}
