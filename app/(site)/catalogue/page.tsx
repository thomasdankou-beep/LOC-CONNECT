import type { Metadata } from "next";
import { PageShell } from "@/components/layout/page-shell";
import { CatalogResults, type CatalogParams } from "@/features/catalog/results";

export const metadata: Metadata = {
  title: "Catalogue de location de matériel en Côte d'Ivoire",
  description: "Parcourez le catalogue LOC'CONNECT : mobilier, chapiteaux, sonorisation, éclairage, outillage. Filtrez par ville, prix et disponibilité sur vos dates.",
  alternates: { canonical: "/catalogue" },
};

export default async function CataloguePage({ searchParams }: { searchParams: Promise<CatalogParams> }) {
  const params = await searchParams;
  return (
    <PageShell title="Catalogue" description="Trouvez le matériel dont vous avez besoin, auprès de loueurs vérifiés, disponible sur vos dates.">
      <CatalogResults params={params} basePath="/catalogue" />
    </PageShell>
  );
}
