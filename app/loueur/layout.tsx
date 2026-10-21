import { redirect } from "next/navigation";
import { getActor } from "@/lib/auth/actor";
import { LenderShell } from "@/components/layout/lender-shell";
import { Notice } from "@/components/ui/states";

export default async function LenderLayout({ children }: { children: React.ReactNode }) {
  const actor = await getActor();
  if (!actor) redirect("/connexion?next=/loueur/dashboard");
  if (actor.accountType === "CLIENT") redirect("/mon-compte");
  if (actor.accountType === "ADMIN") redirect("/admin");
  if (!actor.lenderId) redirect("/");
  return (
    <LenderShell actor={actor}>
      {actor.lenderStatus !== "APPROVED" && (
        <div className="mb-6">
          <Notice tone={actor.lenderStatus === "PENDING" ? "warning" : "danger"} title={actor.lenderStatus === "PENDING" ? "Votre entreprise est en cours de validation" : actor.lenderStatus === "SUSPENDED" ? "Votre compte est suspendu" : "Votre demande a été rejetée"}>
            {actor.lenderStatus === "PENDING" ? "Vous pouvez préparer vos produits en brouillon. Ils seront publiables dès que notre équipe aura validé votre entreprise." : "Contactez le support LOC'CONNECT pour plus d'informations."}
          </Notice>
        </div>
      )}
      {children}
    </LenderShell>
  );
}
