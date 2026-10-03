"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { SlidersHorizontal } from "@/components/ui/icons";
import { toISODate, todayUTC } from "@/lib/dates";

export type FilterValues = { q?: string; category?: string; city?: string; start?: string; end?: string; available?: string; min?: string; max?: string; sort?: string };
type Cat = { slug: string; name: string; children: { slug: string; name: string }[] };

const CONTROL = "h-11 w-full rounded-control border border-line bg-surface px-3 text-[15px] text-ink focus-visible:border-royal focus-visible:outline-2 focus-visible:outline-royal/30";
const LABEL = "mb-1.5 block text-sm font-medium text-ink";

function Fields({ values, categories, cities }: { values: FilterValues; categories: Cat[]; cities: { slug: string; name: string }[] }) {
  const min = toISODate(todayUTC());
  return (
    <div className="space-y-5">
      <div>
        <label htmlFor="f-q" className={LABEL}>Recherche</label>
        <input id="f-q" name="q" defaultValue={values.q} placeholder="Nom, catégorie, loueur" className={CONTROL} />
      </div>
      <div>
        <label htmlFor="f-category" className={LABEL}>Catégorie</label>
        <select id="f-category" name="category" defaultValue={values.category ?? ""} className={CONTROL}>
          <option value="">Toutes les catégories</option>
          {categories.map((c) => (
            <optgroup key={c.slug} label={c.name}>
              <option value={c.slug}>Tout : {c.name}</option>
              {c.children.map((ch) => (
                <option key={ch.slug} value={ch.slug}>
                  {ch.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="f-city" className={LABEL}>Ville</label>
        <select id="f-city" name="city" defaultValue={values.city ?? ""} className={CONTROL}>
          <option value="">Toutes les villes</option>
          {cities.map((c) => (
            <option key={c.slug} value={c.slug}>{c.name}</option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="f-start" className={LABEL}>Début</label>
          <input id="f-start" type="date" name="start" min={min} defaultValue={values.start} className={CONTROL} />
        </div>
        <div>
          <label htmlFor="f-end" className={LABEL}>Fin</label>
          <input id="f-end" type="date" name="end" min={min} defaultValue={values.end} className={CONTROL} />
        </div>
      </div>
      <label className="flex items-start gap-2.5 text-sm text-ink">
        <input type="checkbox" name="available" value="1" defaultChecked={values.available === "1"} className="mt-1 size-4 accent-[var(--lc-royal)]" />
        <span>Seulement les produits disponibles sur la période choisie</span>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="f-min" className={LABEL}>Prix min (FCFA)</label>
          <input id="f-min" type="number" name="min" min={0} step={500} defaultValue={values.min} className={CONTROL} />
        </div>
        <div>
          <label htmlFor="f-max" className={LABEL}>Prix max (FCFA)</label>
          <input id="f-max" type="number" name="max" min={0} step={500} defaultValue={values.max} className={CONTROL} />
        </div>
      </div>
      <input type="hidden" name="sort" value={values.sort ?? ""} />
    </div>
  );
}

/** Filtres du catalogue : barre latérale sur ordinateur, boîte de dialogue sur mobile. Appliqués via l'URL (partageable, indexable). */
export function CatalogFilters({ values, categories, cities, basePath = "/catalogue" }: { values: FilterValues; categories: Cat[]; cities: { slug: string; name: string }[]; basePath?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  function apply(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const sp = new URLSearchParams();
    for (const [k, v] of fd.entries()) if (typeof v === "string" && v.trim()) sp.set(k, v.trim());
    setOpen(false);
    startTransition(() => router.push(`${basePath}${sp.size ? `?${sp}` : ""}`));
  }

  const activeCount = Object.entries(values).filter(([k, v]) => v && k !== "sort").length;

  const form = (id: string) => (
    <form id={id} onSubmit={apply}>
      <Fields values={values} categories={categories} cities={cities} />
      <div className="mt-6 flex gap-2">
        <Button type="submit" className="flex-1" loading={pending}>Appliquer</Button>
        <Button variant="secondary" onClick={() => { setOpen(false); startTransition(() => router.push(basePath)); }}>Réinitialiser</Button>
      </div>
    </form>
  );

  return (
    <>
      <div className="lg:hidden">
        <Button variant="secondary" onClick={() => setOpen(true)} className="w-full">
          <SlidersHorizontal size={18} /> Filtres{activeCount > 0 ? ` (${activeCount})` : ""}
        </Button>
        <Modal open={open} onClose={() => setOpen(false)} title="Filtrer les produits" size="md">
          {form("filters-mobile")}
        </Modal>
      </div>
      <aside className="hidden self-start rounded-card border border-line bg-surface p-5 shadow-card lg:sticky lg:top-24 lg:block" aria-label="Filtres">
        <h2 className="mb-4 text-base font-semibold text-ink">Filtres</h2>
        {form("filters-desktop")}
      </aside>
    </>
  );
}
