import type { Metadata } from "next";
import { db } from "@/lib/db";
import { pageAdmin } from "@/lib/auth/page";
import { Badge } from "@/components/ui/badge";
import { Card, PageHeader } from "@/components/ui/card";
import { ActionButton, FormAction } from "@/components/ui/action";
import { CategoryIcon, Plus } from "@/components/ui/icons";

export const metadata: Metadata = { title: "Catégories", robots: { index: false } };

const ICONS = ["Armchair", "Chair", "Tent", "ForkKnife", "SpeakerHigh", "Lightbulb", "Flower", "Couch", "HardHat", "Wrench", "Truck", "Package"];
const iconField = (defaultValue?: string) => ({ name: "icon", label: "Icône", type: "select" as const, options: ICONS.map((i) => ({ value: i, label: i })), defaultValue: defaultValue ?? "Package" });

export default async function Page() {
  await pageAdmin("ADMIN_CATALOG");
  const all = await db.category.findMany({ include: { _count: { select: { products: true } } }, orderBy: [{ position: "asc" }, { name: "asc" }] });
  const roots = all.filter((c) => !c.parentId);
  const children = (id: string) => all.filter((c) => c.parentId === id);

  return (
    <>
      <PageHeader
        title="Catégories et sous-catégories"
        description="Structure du catalogue public. Désactiver une catégorie la masque sans toucher aux produits."
        actions={<FormAction endpoint="/api/admin/categories" label="Nouvelle catégorie" icon={<Plus size={18} />} title="Nouvelle catégorie" fields={[{ name: "name", label: "Nom", required: true }, { name: "description", label: "Description", type: "textarea" }, iconField(), { name: "position", label: "Position", type: "number", min: 0, defaultValue: roots.length + 1 }]} submitLabel="Créer" success="Catégorie créée" variant="primary" size="md" />}
      />
      <div className="space-y-4">
        {roots.map((c) => (
          <Card key={c.id}>
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-control bg-royal-soft text-royal-ink"><CategoryIcon name={c.icon} size={22} /></span>
                <div className="min-w-0">
                  <p className="font-semibold text-ink">{c.name} {!c.active && <Badge tone="neutral">Masquée</Badge>}</p>
                  <p className="text-sm text-muted">{c._count.products} produit{c._count.products > 1 ? "s" : ""} directs · {children(c.id).length} sous-catégorie{children(c.id).length > 1 ? "s" : ""} · position {c.position}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <FormAction endpoint="/api/admin/categories" label="Sous-catégorie" icon={<Plus size={16} />} title={`Nouvelle sous-catégorie de ${c.name}`} fields={[{ name: "name", label: "Nom", required: true }, { name: "description", label: "Description", type: "textarea" }, { name: "position", label: "Position", type: "number", min: 0, defaultValue: children(c.id).length + 1 }]} extra={{ parentId: c.id, icon: c.icon }} submitLabel="Créer" success="Sous-catégorie créée" />
                <FormAction endpoint={`/api/admin/categories/${c.id}`} method="PATCH" label="Modifier" title={`Modifier ${c.name}`} fields={[{ name: "name", label: "Nom", required: true, defaultValue: c.name }, { name: "description", label: "Description", type: "textarea", defaultValue: c.description ?? "" }, iconField(c.icon), { name: "position", label: "Position", type: "number", min: 0, defaultValue: c.position }]} submitLabel="Enregistrer" success="Catégorie mise à jour" />
                <ActionButton endpoint={`/api/admin/categories/${c.id}`} method="PATCH" body={{ active: !c.active }} label={c.active ? "Masquer" : "Afficher"} success={c.active ? "Catégorie masquée" : "Catégorie affichée"} />
              </div>
            </div>
            {children(c.id).length > 0 && (
              <ul className="divide-y divide-line border-t border-line bg-surface-2/40">
                {children(c.id).map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3 pl-8 pr-5 sm:pl-[4.75rem]">
                    <p className="text-sm text-ink">{s.name} {!s.active && <Badge tone="neutral">Masquée</Badge>} <span className="text-muted">· {s._count.products} produit{s._count.products > 1 ? "s" : ""}</span></p>
                    <div className="flex gap-2">
                      <FormAction endpoint={`/api/admin/categories/${s.id}`} method="PATCH" label="Modifier" title={`Modifier ${s.name}`} fields={[{ name: "name", label: "Nom", required: true, defaultValue: s.name }, { name: "description", label: "Description", type: "textarea", defaultValue: s.description ?? "" }, { name: "position", label: "Position", type: "number", min: 0, defaultValue: s.position }]} submitLabel="Enregistrer" success="Sous-catégorie mise à jour" />
                      <ActionButton endpoint={`/api/admin/categories/${s.id}`} method="PATCH" body={{ active: !s.active }} label={s.active ? "Masquer" : "Afficher"} success={s.active ? "Sous-catégorie masquée" : "Sous-catégorie affichée"} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ))}
      </div>
    </>
  );
}
