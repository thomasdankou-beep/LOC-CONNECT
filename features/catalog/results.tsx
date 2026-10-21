import Link from "next/link";
import { getActor } from "@/lib/auth/actor";
import { db } from "@/lib/db";
import { parseDate } from "@/lib/dates";
import { listCategoryTree, listCities, searchProducts, type ProductSort } from "@/services/catalog";
import { EmptyState } from "@/components/ui/states";
import { Pagination } from "@/components/ui/pagination";
import { LinkButton } from "@/components/ui/button";
import { MagnifyingGlass } from "@/components/ui/icons";
import { CatalogFilters, type FilterValues } from "./filters";
import { ProductCard } from "./product-card";
import { SortSelect } from "./sort-select";

export type CatalogParams = { q?: string; category?: string; city?: string; start?: string; end?: string; available?: string; min?: string; max?: string; sort?: string; page?: string };

const isDate = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);
const num = (v?: string) => (v && /^\d+$/.test(v) ? Number(v) : undefined);

/** Liste filtrée de produits : utilisée par /catalogue, /categories/[slug] et /villes/[slug]. */
export async function CatalogResults({ params, basePath, lockedCategory, lockedCity, heading }: { params: CatalogParams; basePath: string; lockedCategory?: string; lockedCity?: string; heading?: React.ReactNode }) {
  const [actor, categories, cities] = await Promise.all([getActor(), listCategoryTree(), listCities()]);
  const start = isDate(params.start);
  const end = isDate(params.end);
  const validPeriod = start && end && start < end;
  const category = lockedCategory ?? params.category;
  const city = lockedCity ?? params.city;
  const page = Math.max(1, Number(params.page) || 1);

  const result = await searchProducts({
    q: params.q,
    category,
    city,
    minPrice: num(params.min),
    maxPrice: num(params.max),
    start: validPeriod ? parseDate(start) : undefined,
    end: validPeriod ? parseDate(end) : undefined,
    availableOnly: params.available === "1" && Boolean(validPeriod),
    sort: (["relevance", "price_asc", "price_desc", "newest", "rating"].includes(params.sort ?? "") ? params.sort : "relevance") as ProductSort,
    page,
    pageSize: 12,
  });

  const signedIn = Boolean(actor);
  const isClient = actor?.accountType === "CLIENT";
  const favorites = isClient ? new Set((await db.favorite.findMany({ where: { userId: actor!.userId }, select: { productId: true } })).map((f) => f.productId)) : new Set<string>();
  const values: FilterValues = { q: params.q, category: lockedCategory ? undefined : params.category, city: lockedCity ? undefined : params.city, start, end, available: params.available, min: params.min, max: params.max, sort: params.sort };
  const qs = { q: params.q, category: lockedCategory ? undefined : params.category, city: lockedCity ? undefined : params.city, start, end, available: params.available, min: params.min, max: params.max, sort: params.sort };

  return (
    <div className="grid gap-8 lg:grid-cols-[19rem_1fr]">
      <CatalogFilters values={values} categories={categories.map((c) => ({ slug: c.slug, name: c.name, children: c.children.map((ch) => ({ slug: ch.slug, name: ch.name })) }))} cities={cities.map((c) => ({ slug: c.slug, name: c.name }))} basePath={basePath} />
      <section aria-live="polite">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[15px] text-muted">
            {heading}
            <span className="font-medium text-ink">{result.total}</span> produit{result.total > 1 ? "s" : ""}
            {validPeriod ? ` pour la période du ${start} au ${end}` : ""}
          </p>
          <SortSelect basePath={basePath} />
        </div>
        {params.available === "1" && !validPeriod && <p className="mb-4 rounded-control bg-warn-soft px-3 py-2 text-sm text-ink">Choisissez une date de début et une date de fin pour filtrer par disponibilité.</p>}
        {result.items.length === 0 ? (
          <EmptyState
            icon={<MagnifyingGlass size={24} />}
            title="Aucun produit ne correspond à votre recherche"
            description="Essayez d'élargir la période, de choisir une autre ville ou de retirer certains filtres."
            action={<LinkButton href={basePath} variant="secondary">Réinitialiser les filtres</LinkButton>}
          />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {result.items.map((p) => (
              <ProductCard key={p.id} product={p} signedIn={signedIn} isClient={isClient} favorite={favorites.has(p.id)} start={validPeriod ? start : undefined} end={validPeriod ? end : undefined} />
            ))}
          </div>
        )}
        <Pagination page={result.page} totalPages={result.totalPages} basePath={basePath} params={qs} />
      </section>
      <Link href="#contenu" className="sr-only">Retour en haut</Link>
    </div>
  );
}
