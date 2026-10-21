import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getActor } from "@/lib/auth/actor";
import { env } from "@/lib/env";
import { Notice } from "@/components/ui/states";
import { LoginForm } from "@/features/auth/forms";

export const metadata: Metadata = { title: "Connexion", robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; reset?: string }> }) {
  const sp = await searchParams;
  const actor = await getActor();
  if (actor) redirect(actor.accountType === "ADMIN" ? "/admin" : actor.accountType === "LENDER" ? "/loueur/dashboard" : "/mon-compte");
  return (
    <>
      <h1 className="text-3xl font-semibold text-ink">Bon retour parmi nous</h1>
      <p className="mt-2 text-muted">Connectez-vous pour réserver, suivre vos locations ou gérer votre activité.</p>
      {sp.reset && <div className="mt-6"><Notice tone="success">Votre mot de passe a été modifié. Vous pouvez vous connecter.</Notice></div>}
      <div className="mt-8">
        <LoginForm next={sp.next} demo={env().DEMO_MODE === "1"} />
      </div>
      <p className="mt-8 text-center text-sm text-muted">
        Pas encore de compte ? <Link href="/inscription" className="font-medium text-royal-ink hover:underline">Créer un compte</Link> ou <Link href="/devenir-loueur" className="font-medium text-royal-ink hover:underline">devenir loueur</Link>
      </p>
    </>
  );
}
