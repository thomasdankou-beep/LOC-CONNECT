import type { ReactNode } from "react";

/** Gabarit des pages publiques : en-tête de page + contenu, largeur contenue. */
export function PageShell({ title, description, children, narrow }: { title: string; description?: string; children: ReactNode; narrow?: boolean }) {
  return (
    <div className={`mx-auto px-4 pb-4 pt-10 sm:px-6 ${narrow ? "max-w-3xl" : "max-w-7xl"}`}>
      <header className="mb-8 max-w-3xl">
        <h1 className="text-3xl font-semibold text-ink sm:text-4xl">{title}</h1>
        {description && <p className="mt-2 text-[17px] text-muted">{description}</p>}
      </header>
      {children}
    </div>
  );
}
