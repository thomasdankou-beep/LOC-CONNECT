import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireClient } from "@/lib/auth/actor";
import { productCardInclude } from "@/services/catalog";
import { PageHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { LinkButton } from "@/components/ui/button";
import { Heart } from "@/components/ui/icons";
import { ProductCard } from "@/features/catalog/product-card";

export const metadata: Metadata = { title: "Mes favoris", robots: { index: false } };

export default async function Page() {
  const actor = await requireClient();
  const rows = await db.favorite.findMany({ where: { userId: actor.userId, product: { status: "PUBLISHED", deletedAt: null } }, include: { product: { include: productCardInclude } }, orderBy: { createdAt: "desc" } });
  return (
    <>
      <PageHeader title="Mes favoris" description="Les produits que vous avez gardés de côté." />
      {rows.length === 0 ? (
        <EmptyState icon={<Heart size={24} />} title="Aucun favori" description="Touchez le coeur d'un produit pour le retrouver ici." action={<LinkButton href="/catalogue">Parcourir le catalogue</LinkButton>} />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {rows.map((f) => (
            <ProductCard key={f.productId} product={f.product} signedIn isClient favorite />
          ))}
        </div>
      )}
    </>
  );
}
