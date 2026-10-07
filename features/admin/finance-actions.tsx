"use client";

import { ActionButton, FormAction } from "@/components/ui/action";
import { PAYOUT_METHOD } from "@/lib/labels";

export function DepositActions({ id, amount }: { id: string; amount: number }) {
  return (
    <div className="flex flex-wrap gap-2">
      <ActionButton endpoint={`/api/deposits/${id}/release`} method="PATCH" body={{}} label="Libérer" success="Caution libérée" confirm={{ title: "Libérer la caution ?", description: "La caution est entièrement restituée au client. Un constat de retour doit exister.", confirmLabel: "Libérer" }} />
      <FormAction endpoint={`/api/deposits/${id}/withhold`} method="PATCH" label="Retenir" title="Retenue de caution" description={`Décision d'arbitrage. Le montant retenu (maximum ${new Intl.NumberFormat("fr-FR").format(amount)} FCFA) est crédité au loueur, le reste est restitué au client.`} fields={[{ name: "amount", label: "Montant retenu (FCFA)", type: "number", required: true, min: 0, max: amount }, { name: "reason", label: "Motif", type: "textarea", required: true }]} submitLabel="Appliquer" success="Retenue appliquée" />
    </div>
  );
}

export function RunPayout({ lenderId, disabled }: { lenderId: string; disabled?: boolean }) {
  return <ActionButton endpoint="/api/admin/payouts" body={{ lenderId }} label="Verser" variant="primary" disabled={disabled} success="Versement enregistré (simulé)" confirm={{ title: "Effectuer le versement ?", description: "Le montant disponible, déductions comprises, est versé au loueur. Dans cette version le versement est simulé et ne déplace aucun fonds réel.", confirmLabel: "Verser" }} />;
}

export function RunAllPayouts({ disabled }: { disabled?: boolean }) {
  return <ActionButton endpoint="/api/admin/payouts" body={{}} label="Verser tous les loueurs éligibles" variant="primary" size="md" disabled={disabled} success="Versements enregistrés (simulés)" confirm={{ title: "Verser tous les loueurs éligibles ?", description: "Chaque loueur disposant de coordonnées et d'un solde disponible est versé. Les versements sont simulés dans cette version.", confirmLabel: "Tout verser" }} />;
}

export function ValidationDecision({ id }: { id: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      <ActionButton endpoint={`/api/admin/validations/${id}`} method="PATCH" body={{ approve: true }} label="Valider" variant="primary" success="Coordonnées validées" confirm={{ title: "Valider ces coordonnées ?", description: "Les prochains versements seront envoyés vers ces nouvelles coordonnées. Vérifiez l'identité du demandeur avant de valider." , confirmLabel: "Valider" }} />
      <FormAction endpoint={`/api/admin/validations/${id}`} method="PATCH" label="Refuser" title="Refuser la demande" fields={[{ name: "reason", label: "Motif", type: "textarea", required: true }]} extra={{ approve: false }} submitLabel="Refuser" success="Demande refusée" />
    </div>
  );
}

export function RecoveryAction({ id }: { id: string }) {
  return <FormAction endpoint={`/api/admin/recoveries/${id}`} method="PATCH" label="Marquer comme recouvré" title="Recouvrement manuel" description="Le loueur a remboursé la plateforme hors versement. La déduction en attente est neutralisée." fields={[{ name: "note", label: "Note (référence du règlement)", type: "textarea" }]} submitLabel="Marquer comme recouvré" success="Recouvrement enregistré" />;
}

export function SubscriptionForm({ lenders }: { lenders: { id: string; name: string }[] }) {
  return (
    <FormAction
      endpoint="/api/admin/subscriptions"
      label="Nouvel abonnement"
      title="Attribuer une formule"
      description="Effet immédiat : le taux de commission de la formule s'applique aux nouvelles réservations. La formule active précédente est clôturée. À l'échéance, la formule est renouvelée au prix en vigueur."
      fields={[
        { name: "lenderId", label: "Loueur", type: "select", required: true, options: lenders.map((l) => ({ value: l.id, label: l.name })) },
        { name: "plan", label: "Formule", type: "select", required: true, options: [{ value: "FREE", label: "Découverte" }, { value: "PRO", label: "Pro" }, { value: "PREMIUM", label: "Premium" }] },
        { name: "months", label: "Durée (mois)", type: "number", min: 1, max: 36, defaultValue: 1 },
        { name: "amount", label: "Montant facturé pour la durée (FCFA)", type: "number", min: 0, hint: "Laissez vide pour le prix en vigueur x durée ; 0 pour offrir la période. Déduit des versements du loueur." },
        { name: "note", label: "Note interne", placeholder: "Ex. : partenaire de lancement" },
      ]}
      submitLabel="Attribuer"
      success="Abonnement créé"
      variant="primary"
      size="md"
    />
  );
}

export function PromotionForm({ products }: { products: { id: string; name: string }[] }) {
  return (
    <FormAction
      endpoint="/api/admin/promotions"
      label="Nouvelle mise en avant"
      title="Mettre un produit en avant"
      description="Le produit apparaît dans les sélections mises en avant du catalogue pendant la durée choisie."
      fields={[
        { name: "productId", label: "Produit", type: "select", required: true, options: products.map((p) => ({ value: p.id, label: p.name })) },
        { name: "type", label: "Type", type: "select", required: true, options: [{ value: "FEATURED", label: "Mis en avant" }, { value: "SPONSORED", label: "Sponsorisé" }] },
        { name: "days", label: "Durée (jours)", type: "number", required: true, min: 1, max: 365, defaultValue: 14 },
        { name: "amountPaid", label: "Montant payé (FCFA)", type: "number", min: 0, defaultValue: 0 },
      ]}
      submitLabel="Créer"
      success="Mise en avant créée"
      variant="primary"
      size="md"
    />
  );
}

export function PromotionToggle({ id, active }: { id: string; active: boolean }) {
  return <ActionButton endpoint={`/api/admin/promotions/${id}`} method="PATCH" body={{ active: !active }} label={active ? "Arrêter" : "Réactiver"} success={active ? "Mise en avant arrêtée" : "Mise en avant réactivée"} />;
}

export const PAYOUT_METHOD_LABELS = PAYOUT_METHOD;
