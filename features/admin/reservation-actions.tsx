"use client";

import { ActionButton, FormAction } from "@/components/ui/action";
import { RESERVATION_STATUS } from "@/lib/labels";

/** Correction manuelle de statut par l'administration : motif obligatoire, journalisée, validée par la machine à états. */
export function StatusCorrection({ reservationId, items }: { reservationId: string; items: { id: string; name: string }[] }) {
  return (
    <FormAction
      endpoint={`/api/reservations/${reservationId}`}
      method="PATCH"
      label="Corriger un statut"
      title="Correction administrative"
      description="Les transitions interdites par la machine à états sont refusées. L'action est journalisée avec votre motif."
      fields={[
        { name: "itemId", label: "Ligne concernée", type: "select", required: true, options: [{ value: "", label: "Toutes les lignes" }, ...items.map((i) => ({ value: i.id, label: i.name }))] },
        { name: "status", label: "Nouveau statut", type: "select", required: true, options: Object.entries(RESERVATION_STATUS).filter(([k]) => !["DRAFT", "HOLD", "PENDING_PAYMENT", "DISPUTED"].includes(k)).map(([value, e]) => ({ value, label: e.label })) },
        { name: "note", label: "Motif", type: "textarea", required: true },
      ]}
      transform={(v) => ({ status: v.status, note: v.note, itemIds: v.itemId ? [v.itemId] : undefined })}
      submitLabel="Appliquer"
      success="Statut corrigé"
    />
  );
}

export function AdminRefund({ paymentId, max, lenders }: { paymentId: string; max: number; lenders: { id: string; name: string }[] }) {
  return (
    <FormAction
      endpoint={`/api/payments/${paymentId}/refunds`}
      label="Rembourser"
      title="Remboursement exceptionnel"
      description={`Geste commercial ou correction d'erreur. Le montant est plafonné à ce qui reste remboursable sur ce paiement (${new Intl.NumberFormat("fr-FR").format(max)} FCFA au total). La part imputée au loueur est déduite de son solde, ou recouvrée s'il a déjà été versé.`}
      fields={[
        { name: "amount", label: "Montant (FCFA)", type: "number", required: true, min: 1, max },
        { name: "reason", label: "Motif", type: "textarea", required: true },
        { name: "lenderId", label: "Loueur concerné", type: "select", options: [{ value: "", label: "Aucun (à la charge de LOC'CONNECT)" }, ...lenders.map((l) => ({ value: l.id, label: l.name }))] },
        { name: "lenderShare", label: "Part imputée au loueur (FCFA)", type: "number", min: 0 },
      ]}
      submitLabel="Rembourser"
      success="Remboursement effectué"
    />
  );
}

export function ModificationAdminActions({ reservationId, modificationId }: { reservationId: string; modificationId: string }) {
  const base = `/api/reservations/${reservationId}/modifications/${modificationId}`;
  return (
    <div className="flex flex-wrap gap-2">
      <ActionButton endpoint={`${base}/relaunch`} label="Relancer le loueur (+2 h)" success="Loueur relancé" />
      <ActionButton endpoint={`${base}/approve`} label="Accepter" variant="primary" success="Modification acceptée" confirm={{ title: "Accepter à la place du loueur ?", description: "L'administration tranche la demande. Le client règle le complément éventuel puis la réservation est mise à jour.", confirmLabel: "Accepter" }} />
      <FormAction endpoint={`${base}/reject`} label="Refuser" title="Refuser la modification" description="Le client est informé du motif." fields={[{ name: "reason", label: "Motif", type: "textarea", required: true }]} submitLabel="Refuser" success="Modification refusée" />
    </div>
  );
}
