import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { PageShell } from "@/components/layout/page-shell";
import { CatalogResults, type CatalogParams } from "@/features/catalog/results";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<CatalogParams> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const c = await db.city.findUnique({ where: { slug } });
  if (!c) return { title: "Ville introuvable" };
  return {
    title: `Location de matériel à ${c.name}`,
    description: `Louez du matériel événementiel, de chantier et d'outillage à ${c.name} (${c.region}) auprès de loueurs vérifiés LOC'CONNECT.`,
    alternates: { canonical: `/villes/${c.slug}` },
  };
}

export default async function CityPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const city = await db.city.findUnique({ where: { slug } });
  if (!city || !city.active) notFound();
  return (
    <PageShell title={`Location de matériel à ${city.name}`} description={`Produits disponibles à ${city.name} et dans les environs, auprès de loueurs vérifiés.`}>
      <CatalogResults params={sp} basePath={`/villes/${city.slug}`} lockedCity={city.slug} />
    </PageShell>
  );
}
