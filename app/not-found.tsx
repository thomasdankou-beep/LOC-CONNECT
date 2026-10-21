import Link from "next/link";
import { Logo } from "@/components/layout/logo";
import { LinkButton } from "@/components/ui/button";
import { MagnifyingGlass } from "@/components/ui/icons";

export const metadata = { title: "Page introuvable", robots: { index: false } };

export default function NotFound() {
  return (
    <main id="contenu" className="flex min-h-dvh flex-col items-center justify-center px-4 py-16 text-center">
      <Logo href="/" />
      <span className="mt-12 flex size-16 items-center justify-center rounded-full bg-royal-soft text-royal-ink"><MagnifyingGlass size={30} /></span>
      <p className="mt-6 text-sm font-semibold uppercase tracking-widest text-royal-ink">Erreur 404</p>
      <h1 className="mt-2 text-3xl font-semibold text-ink sm:text-4xl">Cette page n&apos;existe pas.</h1>
      <p className="mt-3 max-w-md text-muted">Le lien est peut-être incorrect, ou le produit n&apos;est plus disponible. Retrouvez ce que vous cherchez dans le catalogue.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <LinkButton href="/catalogue" size="lg">Parcourir le catalogue</LinkButton>
        <LinkButton href="/" variant="secondary" size="lg">Retour à l&apos;accueil</LinkButton>
      </div>
      <p className="mt-8 text-sm text-muted">Besoin d&apos;aide ? <Link href="/contact" className="font-medium text-royal-ink hover:underline">Contactez-nous</Link>.</p>
    </main>
  );
}
