import type { Metadata } from "next";
import Link from "next/link";
import { listCategoryTree } from "@/services/catalog";
import { categoryPhoto } from "@/lib/images";
import { Photo } from "@/components/ui/photo";
import { CategoryIcon, ArrowRight } from "@/components/ui/icons";
import { PageShell } from "@/components/layout/page-shell";

export const metadata: Metadata = {
  title: "Catégories de matériel à louer",
  description: "Toutes les catégories de location LOC'CONNECT : mobilier, chapiteaux, vaisselle, sonorisation, éclairage, décoration, chantier, outillage, transport.",
  alternates: { canonical: "/categories" },
};

export default async function CategoriesPage() {
  const tree = await listCategoryTree();
  return (
    <PageShell title="Toutes les catégories" description="Choisissez une catégorie pour voir les produits disponibles auprès de loueurs vérifiés.">
      <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {tree.map((c) => (
          <li key={c.id} className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
            <Link href={`/categories/${c.slug}`} className="group relative block aspect-[16/9] overflow-hidden">
              <Photo src={c.imageUrl ?? categoryPhoto(c.name)} alt="" w={700} h={400} className="size-full transition duration-500 group-hover:scale-105" />
              <div className="scrim-navy absolute inset-0" />
              <div className="absolute inset-x-0 bottom-0 flex items-center gap-3 p-4 text-white">
                <span className="flex size-10 items-center justify-center rounded-control bg-white/15 backdrop-blur"><CategoryIcon name={c.icon} /></span>
                <div>
                  <h2 className="text-lg font-semibold">{c.name}</h2>
                  <p className="text-sm text-white/80">{c._count.products} produit{c._count.products > 1 ? "s" : ""}</p>
                </div>
              </div>
            </Link>
            <ul className="divide-y divide-line">
              {c.children.map((ch) => (
                <li key={ch.id}>
                  <Link href={`/categories/${ch.slug}`} className="flex items-center justify-between px-4 py-3 text-sm text-ink transition hover:bg-surface-2">
                    <span>{ch.name}</span>
                    <span className="flex items-center gap-2 text-muted">{ch.productCount} <ArrowRight size={14} /></span>
                  </Link>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </PageShell>
  );
}
