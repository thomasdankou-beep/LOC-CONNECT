import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { PageShell } from "@/components/layout/page-shell";
import { CatalogResults, type CatalogParams } from "@/features/catalog/results";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<CatalogParams> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const c = await db.category.findUnique({ where: { slug } });
  if (!c) return { title: "Catégorie introuvable" };
  return {
    title: `Location de ${c.name.toLowerCase()} en Côte d'Ivoire`,
    description: c.description ?? `Louez ${c.name.toLowerCase()} auprès de loueurs vérifiés en Côte d'Ivoire.`,
    alternates: { canonical: `/categories/${c.slug}` },
  };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const category = await db.category.findUnique({ where: { slug }, include: { parent: true, children: { where: { active: true } } } });
  if (!category || !category.active) notFound();
  return (
    <PageShell title={`Location de ${category.name.toLowerCase()}`} description={category.description ?? undefined}>
      <CatalogResults params={sp} basePath={`/categories/${category.slug}`} lockedCategory={category.slug} />
    </PageShell>
  );
}
