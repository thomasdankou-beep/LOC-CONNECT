"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { WarningCircle } from "@/components/ui/icons";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main id="contenu" className="flex min-h-[70dvh] flex-col items-center justify-center px-4 py-16 text-center">
      <span className="flex size-16 items-center justify-center rounded-full bg-danger-soft text-danger"><WarningCircle size={30} /></span>
      <h1 className="mt-6 text-3xl font-semibold text-ink">Une erreur est survenue</h1>
      <p className="mt-3 max-w-md text-muted">Nous n&apos;avons pas pu afficher cette page. Vos données n&apos;ont pas été modifiées. Réessayez, ou revenez à l&apos;accueil.</p>
      {error.digest && <p className="mt-2 font-mono text-xs text-muted">Référence : {error.digest}</p>}
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button size="lg" onClick={reset}>Réessayer</Button>
        <Link href="/" className="inline-flex h-12 items-center rounded-control border border-line bg-surface px-6 font-medium text-ink hover:bg-surface-2">Accueil</Link>
      </div>
    </main>
  );
}
