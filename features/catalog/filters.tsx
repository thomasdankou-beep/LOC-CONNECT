"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { SlidersHorizontal } from "@/components/ui/icons";
import { toISODate, todayUTC } from "@/lib/dates";

import { SearchDateFields } from "./search-date-fields";

export type FilterValues = { q?: string; category?: string; city?: string; start?: string; end?: string; available?: string; min?: string; max?: string; sort?: string };
type Cat = { slug: string; name: string; children: { slug: string; name: string }[] };

const CONTROL = "h-11 w-full rounded-control border border-line bg-surface px-3 text-[15px] text-ink focus-visible:border-royal focus-visible:outline-2 focus-visible:outline-royal/30";
const LABEL = "mb-1.5 block text-sm font-medium text-ink";

function Fields({ values, categories, cities, autoApply }: { values: FilterValues; categories: Cat[]; cities: { slug: string; name: string }[]; autoApply: boolean }) {
  const id = useId();
  function applySelection(event: React.ChangeEvent<HTMLSelectElement>) {
    if (autoApply) event.currentTarget.form?.requestSubmit();
  }
  const min = toISODate(todayUTC());
  return (
    <div className="space-y-5">
      <div>
        <label htmlFor={`${id}-q`} className={LABEL}>Recherche</label>
        <input id={`${id}-q`} name="q" defaultValue={values.q} placeholder="Nom, catégorie, loueur" className={CONTROL} />
      </div>
      {categories.length > 0 && <div>
        <label htmlFor={`${id}-category`} className={LABEL}>Catégorie</label>
        <select id={`${id}-category`} name="category" defaultValue={values.category ?? ""} onChange={applySelection} className={CONTROL}>
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
      </div>}
      {cities.length > 0 && <div>
        <label htmlFor={`${id}-city`} className={LABEL}>Ville</label>
        <select id={`${id}-city`} name="city" defaultValue={values.city ?? ""} onChange={applySelection} className={CONTROL}>
          <option value="">Toutes les villes</option>
          {cities.map((c) => (
            <option key={c.slug} value={c.slug}>{c.name}</option>
          ))}
        </select>
      </div>}
      <SearchDateFields key={`${values.start ?? ""}/${values.end ?? ""}`} start={values.start} end={values.end} min={min}
        controlClass={CONTROL} labelClass={LABEL} className="min-w-0" />
      <label className="flex items-start gap-2.5 text-sm text-ink">
        <input type="checkbox" name="available" value="1" defaultChecked={values.available === "1"} className="mt-1 size-4 accent-[var(--lc-royal)]" />
        <span>Seulement les produits disponibles sur la période choisie</span>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor={`${id}-min`} className={LABEL}>Prix min (FCFA)</label>
          <input id={`${id}-min`} type="number" name="min" min={0} step={500} defaultValue={values.min} className={CONTROL} />
        </div>
        <div>
          <label htmlFor={`${id}-max`} className={LABEL}>Prix max (FCFA)</label>
          <input id={`${id}-max`} type="number" name="max" min={0} step={500} defaultValue={values.max} className={CONTROL} />
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
  const [resetCount, setResetCount] = useState(0);
  const id = useId();
  const mobileForm = `${id}-mobile`;
  const desktopForm = `${id}-desktop`;
  const fieldsKey = JSON.stringify([values, resetCount]);

  function apply(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const sp = new URLSearchParams();
    for (const [k, v] of fd.entries()) if (typeof v === "string" && v.trim()) sp.set(k, v.trim());
    setOpen(false);
    startTransition(() => router.push(`${basePath}${sp.size ? `?${sp}` : ""}`));
  }

  const activeCount = Object.entries(values).filter(([k, v]) => v && k !== "sort").length;

  function reset() {
    setOpen(false);
    setResetCount((count) => count + 1);
    startTransition(() => router.push(basePath));
  }

  const actions = (formId: string) => (
    <>
      <Button type="submit" form={formId} className="flex-1" loading={pending}>Appliquer</Button>
      <Button variant="secondary" onClick={reset} disabled={pending}>Réinitialiser</Button>
    </>
  );

  return (
    <>
      <div className="lg:hidden">
        <Button variant="secondary" onClick={() => setOpen(true)} className="w-full">
          <SlidersHorizontal size={18} /> Filtres{activeCount > 0 ? ` (${activeCount})` : ""}
        </Button>
        <Modal open={open} onClose={() => setOpen(false)} title="Filtrer les produits" size="md" footer={actions(mobileForm)}>
          <form id={mobileForm} onSubmit={apply}>
            <Fields key={fieldsKey} values={values} categories={categories} cities={cities} autoApply={false} />
          </form>
        </Modal>
      </div>
      <aside className="hidden self-start rounded-card border border-line bg-surface shadow-card lg:sticky lg:top-24 lg:flex lg:max-h-[calc(100dvh-7rem)] lg:flex-col" aria-label="Filtres">
        <h2 className="px-5 pt-5 text-base font-semibold text-ink">Filtres</h2>
        <form id={desktopForm} onSubmit={apply} className="min-h-0 overflow-y-auto px-5 py-4">
          <Fields key={fieldsKey} values={values} categories={categories} cities={cities} autoApply />
        </form>
        <div className="flex gap-2 border-t border-line p-4">{actions(desktopForm)}</div>
      </aside>
    </>
  );
}
