import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui/card";
import { ArrowLeft } from "@/components/ui/icons";
import { CatalogImportForm } from "@/features/lender/catalog-import-form";
import { pageLender } from "@/lib/auth/page";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Importer un catalogue", robots: { index: false } };

export default async function Page() {
  await pageLender("PRODUCT_CREATE");
  const [categories, cities] = await Promise.all([
    db.category.findMany({ select: { name: true, slug: true }, orderBy: { name: "asc" } }),
    db.city.findMany({ select: { name: true, slug: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <>
      <Link href="/loueur/produits" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"><ArrowLeft size={16} /> Mes produits</Link>
      <PageHeader title="Importer un catalogue" description="Vérifiez jusqu’à 200 articles avant de créer leurs fiches." />
      <CatalogImportForm categories={categories} cities={cities} />
    </>
  );
}
