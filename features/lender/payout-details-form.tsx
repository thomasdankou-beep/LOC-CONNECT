"use client";

import { FormAction } from "@/components/ui/action";
import { PAYOUT_METHOD } from "@/lib/labels";

/** Demande de changement des coordonnées de versement : soumise à validation renforcée par l'administration. */
export function PayoutDetailsRequest({ disabled }: { disabled?: boolean }) {
  if (disabled) return null;
  return (
    <FormAction
      endpoint="/api/lenders/me/payout-details"
      label="Modifier mes coordonnées"
      title="Modifier mes coordonnées de versement"
      description="Pour votre sécurité, tout changement est validé par un administrateur avant d'être appliqué. Vos coordonnées actuelles restent utilisées en attendant."
      fields={[
        { name: "method", label: "Moyen de versement", type: "select", required: true, options: Object.entries(PAYOUT_METHOD).map(([value, label]) => ({ value, label })) },
        { name: "account", label: "Numéro de compte ou de mobile", required: true, hint: "Au moins 6 caractères" },
      ]}
      submitLabel="Envoyer la demande"
      success="Demande envoyée à l'administration"
    />
  );
}
