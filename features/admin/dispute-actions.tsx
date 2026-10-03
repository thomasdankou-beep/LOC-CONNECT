"use client";

import { ActionButton, FormAction } from "@/components/ui/action";
import { Card } from "@/components/ui/card";

/** Arbitrage : passage en examen, demande de réponse, décision (client, loueur ou partielle), clôture. */
export function DisputeAdminActions({ id, status, hasReport, disputed }: { id: string; status: string; hasReport: boolean; disputed: number }) {
  const closed = ["RESOLVED", "REJECTED", "CLOSED"].includes(status);
  if (closed) return null;
  const endpoint = `/api/disputes/${id}`;
  return (
    <Card className="p-5">
      <h2 className="text-base font-semibold text-ink">Arbitrage</h2>
      <p className="mt-1 text-sm text-muted">{hasReport ? "Ce litige conteste un constat de retour : la décision fixe la retenue de caution définitive." : "La décision peut rembourser le client. La part est déduite du loueur visé uniquement."}</p>
      <div className="mt-4 flex flex-col gap-2">
        {status === "OPEN" && <ActionButton endpoint={endpoint} method="PATCH" body={{ status: "UNDER_REVIEW" }} label="Prendre en charge" success="Litige en cours d'examen" />}
        {status !== "WAITING_RESPONSE" && <ActionButton endpoint={endpoint} method="PATCH" body={{ status: "WAITING_RESPONSE" }} label="Attendre une réponse" success="En attente de réponse" />}
        <FormAction
          endpoint={endpoint}
          method="PATCH"
          label="Rendre une décision"
          variant="primary"
          title="Décision de l'administration"
          description={hasReport ? "Le montant retenu est plafonné aux dommages déclarés dans le constat. Le reste de la caution est restitué au client." : "Le montant est remboursé au client et déduit du loueur visé."}
          fields={[
            { name: "outcome", label: "Issue", type: "select", required: true, options: [{ value: "CLIENT_FAVOR", label: hasReport ? "En faveur du client (aucune retenue)" : "En faveur du client (remboursement)" }, { value: "LENDER_FAVOR", label: hasReport ? "En faveur du loueur (retenue maintenue)" : "En faveur du loueur (rejet)" }, { value: "PARTIAL", label: "Décision partielle" }] },
            { name: "amount", label: hasReport ? "Montant retenu, si partielle (FCFA)" : "Montant remboursé (FCFA)", type: "number", min: 0, defaultValue: hasReport ? "" : disputed, hint: "Obligatoire pour une décision partielle." },
            { name: "decision", label: "Motivation de la décision", type: "textarea", required: true, hint: "Visible par le client et le loueur." },
          ]}
          submitLabel="Valider la décision"
          success="Décision rendue"
        />
        <ActionButton endpoint={endpoint} method="PATCH" body={{ status: "CLOSED" }} label="Clore sans décision" confirm={{ title: "Clore ce litige ?", description: "Aucun remboursement ni retenue n'est effectué. Utilisez cette action pour un litige retiré ou sans objet." }} success="Litige clos" />
      </div>
    </Card>
  );
}
