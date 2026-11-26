import type { Metadata } from "next";
import { listCities } from "@/services/catalog";
import { RegisterClientForm } from "@/features/auth/forms";

export const metadata: Metadata = { title: "Créer un compte client", description: "Créez votre compte LOC'CONNECT pour louer du matériel auprès de loueurs vérifiés.", alternates: { canonical: "/inscription" } };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ article?: string }> }) {
  const [cities, { article }] = await Promise.all([listCities(), searchParams]);
  const articleId = typeof article === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(article) ? article : undefined;
  return (
    <>
      <h1 className="text-3xl font-semibold text-ink">Créer votre compte</h1>
      <p className="mt-2 text-muted">Réservez du matériel, payez une seule fois et suivez vos locations.</p>
      <div className="mt-8">
        <RegisterClientForm articleId={articleId} cities={cities.map((c) => ({ id: c.id, name: c.name }))} />
      </div>
    </>
  );
}
