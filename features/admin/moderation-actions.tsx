"use client";

import { ActionButton, FormAction } from "@/components/ui/action";

const reason = (label = "Motif", required = true) => [{ name: "reason", label, type: "textarea" as const, required }];

export function LenderActions({ id, status, commissionBps, defaultBps }: { id: string; status: "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED"; commissionBps: number | null; defaultBps: number }) {
  const endpoint = `/api/admin/lenders/${id}`;
  return (
    <div className="flex flex-wrap gap-2">
      {(status === "PENDING" || status === "REJECTED") && <ActionButton endpoint={endpoint} method="PATCH" body={{ decision: "approve" }} label="Valider" variant="primary" success="Loueur validé" confirm={{ title: "Valider ce loueur ?", description: "Il pourra publier des produits et recevoir des réservations.", confirmLabel: "Valider" }} />}
      {status === "PENDING" && <FormAction endpoint={endpoint} method="PATCH" label="Rejeter" title="Rejeter la demande" description="Le motif est communiqué au loueur." fields={reason()} extra={{ decision: "reject" }} submitLabel="Rejeter" success="Demande rejetée" />}
      {status === "APPROVED" && <FormAction endpoint={endpoint} method="PATCH" label="Suspendre" title="Suspendre le loueur" description="Ses produits sont désactivés et ses montants à verser sont bloqués." fields={reason()} extra={{ decision: "suspend" }} submitLabel="Suspendre" success="Loueur suspendu" />}
      {status === "SUSPENDED" && <ActionButton endpoint={endpoint} method="PATCH" body={{ decision: "reactivate" }} label="Réactiver" success="Loueur réactivé" confirm={{ title: "Réactiver ce loueur ?", description: "Ses montants bloqués hors litige sont libérés. Ses produits restent désactivés jusqu'à republication." }} />}
      <FormAction
        endpoint={`${endpoint}/commission`}
        method="PATCH"
        label="Commission"
        title="Commission spécifique"
        description={`Taux par défaut de la plateforme : ${defaultBps / 100} %. Laissez vide pour appliquer ce taux. Le changement ne concerne que les nouvelles réservations.`}
        fields={[{ name: "percent", label: "Taux de commission (%)", type: "number", min: 0, max: 50, step: "any", defaultValue: commissionBps == null ? "" : commissionBps / 100, hint: "Entre 0 et 50, par exemple 7,5" }]}
        transform={(v) => ({ commissionRateBps: v.percent === undefined || Number.isNaN(Number(v.percent)) ? null : Math.round(Number(v.percent) * 100) })}
        submitLabel="Enregistrer"
        success="Commission mise à jour"
      />
    </div>
  );
}

export function ProductActions({ id, status }: { id: string; status: string }) {
  const endpoint = `/api/admin/products/${id}`;
  return (
    <div className="flex flex-wrap gap-2">
      {["PENDING_REVIEW", "REJECTED", "INACTIVE"].includes(status) && <ActionButton endpoint={endpoint} method="PATCH" body={{ decision: "approve" }} label={status === "PENDING_REVIEW" ? "Publier" : "Republier"} variant="primary" success="Produit publié" />}
      {status === "PENDING_REVIEW" && <FormAction endpoint={endpoint} method="PATCH" label="Refuser" title="Refuser le produit" description="Le motif est communiqué au loueur." fields={reason()} extra={{ decision: "reject" }} submitLabel="Refuser" success="Produit refusé" />}
      {status === "PUBLISHED" && <FormAction endpoint={endpoint} method="PATCH" label="Suspendre" title="Suspendre le produit" description="Il disparaît du catalogue. Les réservations existantes ne sont pas touchées." fields={reason("Motif", false)} extra={{ decision: "suspend" }} submitLabel="Suspendre" success="Produit suspendu" />}
    </div>
  );
}

export function UserActions({ id, status, self }: { id: string; status: "ACTIVE" | "SUSPENDED" | "DEACTIVATED"; self: boolean }) {
  if (self) return <span className="text-xs text-muted">Vous</span>;
  const endpoint = `/api/admin/users/${id}`;
  return status === "ACTIVE" ? (
    <FormAction endpoint={endpoint} method="PATCH" label="Suspendre" title="Suspendre l'utilisateur" description="Ses sessions sont fermées immédiatement. L'historique est conservé." fields={reason("Motif", false)} extra={{ status: "SUSPENDED" }} submitLabel="Suspendre" success="Utilisateur suspendu" />
  ) : (
    <ActionButton endpoint={endpoint} method="PATCH" body={{ status: "ACTIVE" }} label="Réactiver" success="Utilisateur réactivé" />
  );
}

export function ReviewActions({ id, status }: { id: string; status: "PUBLISHED" | "HIDDEN" | "PENDING" }) {
  return status === "PUBLISHED" ? (
    <ActionButton endpoint={`/api/admin/reviews/${id}`} method="PATCH" body={{ status: "HIDDEN" }} label="Masquer" success="Avis masqué" confirm={{ title: "Masquer cet avis ?", description: "Il disparaît de la fiche produit et n'entre plus dans les notes moyennes." }} />
  ) : (
    <ActionButton endpoint={`/api/admin/reviews/${id}`} method="PATCH" body={{ status: "PUBLISHED" }} label="Publier" variant="primary" success="Avis publié" />
  );
}
