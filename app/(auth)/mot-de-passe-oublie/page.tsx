import type { Metadata } from "next";
import Link from "next/link";
import { ForgotForm, ResetForm } from "@/features/auth/forms";

export const metadata: Metadata = { title: "Mot de passe oublié", robots: { index: false } };

export default async function ForgotPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <>
      <h1 className="text-3xl font-semibold text-ink">{token ? "Nouveau mot de passe" : "Mot de passe oublié"}</h1>
      <p className="mt-2 text-muted">{token ? "Choisissez un nouveau mot de passe pour votre compte." : "Saisissez votre adresse e-mail pour recevoir un lien de réinitialisation."}</p>
      <div className="mt-8">{token ? <ResetForm token={token} /> : <ForgotForm />}</div>
      <p className="mt-8 text-center text-sm text-muted">
        <Link href="/connexion" className="font-medium text-royal-ink hover:underline">Retour à la connexion</Link>
      </p>
    </>
  );
}
