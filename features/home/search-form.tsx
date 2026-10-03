import { Button } from "@/components/ui/button";
import { MagnifyingGlass } from "@/components/ui/icons";
import { toISODate, todayUTC } from "@/lib/dates";

const CONTROL = "h-12 w-full rounded-control border border-line bg-canvas px-3 text-[15px] text-ink placeholder:text-muted focus-visible:border-royal focus-visible:outline-2 focus-visible:outline-royal/30";
const LABEL = "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted";

/** Moteur de recherche (formulaire GET, fonctionne sans JavaScript) : produit, ville, dates. */
export function SearchForm({ cities, defaults, wide }: { cities: { slug: string; name: string }[]; defaults?: { q?: string; city?: string; start?: string; end?: string }; wide?: boolean }) {
  const min = toISODate(todayUTC());
  return (
    <form action="/catalogue" method="get" role="search" className="rounded-card border border-line bg-surface p-3 text-ink shadow-card sm:p-4">
      <div className={wide ? "grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_1fr_auto] lg:items-end" : "grid gap-3 sm:grid-cols-2"}>
        <div>
          <label htmlFor="s-q" className={LABEL}>
            Que recherchez-vous ?
          </label>
          <input id="s-q" name="q" defaultValue={defaults?.q} placeholder="Tables, chaises, chapiteaux..." className={CONTROL} autoComplete="off" />
        </div>
        <div>
          <label htmlFor="s-city" className={LABEL}>
            Ville
          </label>
          <select id="s-city" name="city" defaultValue={defaults?.city ?? ""} className={CONTROL}>
            <option value="">Toutes les villes</option>
            {cities.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="s-start" className={LABEL}>
            Date de début
          </label>
          <input id="s-start" name="start" type="date" min={min} defaultValue={defaults?.start} className={CONTROL} />
        </div>
        <div>
          <label htmlFor="s-end" className={LABEL}>
            Date de fin
          </label>
          <input id="s-end" name="end" type="date" min={min} defaultValue={defaults?.end} className={CONTROL} />
        </div>
        <Button type="submit" size="lg" className={wide ? "w-full sm:col-span-2 lg:col-span-1" : "w-full sm:col-span-2"}>
          <MagnifyingGlass size={20} /> Rechercher
        </Button>
      </div>
    </form>
  );
}
