import { MagnifyingGlass } from "./icons";

/** Barre de recherche et de filtre par statut (formulaire GET : fonctionne sans JavaScript). */
export function FilterBar({ basePath, q, status, statuses, placeholder = "Rechercher", extra }: { basePath: string; q?: string; status?: string; statuses?: { value: string; label: string }[]; placeholder?: string; extra?: React.ReactNode }) {
  return (
    <form action={basePath} method="get" role="search" className="mb-5 flex flex-wrap items-center gap-3">
      <div className="relative min-w-60 flex-1 sm:max-w-sm">
        <MagnifyingGlass size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input name="q" defaultValue={q} placeholder={placeholder} aria-label={placeholder} className="h-11 w-full rounded-control border border-line bg-surface pl-10 pr-3 text-[15px] text-ink placeholder:text-muted focus-visible:border-royal" />
      </div>
      {statuses && (
        <select name="status" defaultValue={status ?? ""} aria-label="Statut" className="h-11 rounded-control border border-line bg-surface px-3 text-[15px] text-ink">
          <option value="">Tous les statuts</option>
          {statuses.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      )}
      {extra}
      <button type="submit" className="h-11 rounded-control bg-navy px-5 text-sm font-medium text-white hover:opacity-90">Filtrer</button>
    </form>
  );
}
