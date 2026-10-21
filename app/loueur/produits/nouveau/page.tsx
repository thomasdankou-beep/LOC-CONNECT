import type { Metadata } from "next";
import Link from "next/link";
import { pageLender } from "@/lib/auth/page";
import { getSettings } from "@/lib/settings";
import { listCategoryTree, listCities } from "@/services/catalog";
import { PageHeader } from "@/components/ui/card";
import { ProductForm } from "@/features/lender/product-form";
import { depositFloorFrom, depositPercentFrom } from "@/services/pricing";
import { ArrowLeft } from "@/components/ui/icons";

export const metadata: Metadata = { title: "Nouveau produit", robots: { index: false } };

export default async function Page() {
  const actor = await pageLender("PRODUCT_CREATE");
  const [categories, cities, settings] = await Promise.all([listCategoryTree(), listCities(), getSettings()]);
  return (
    <>
      <Link href="/loueur/produits" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"><ArrowLeft size={16} /> Mes produits</Link>
      <PageHeader title="Nouveau produit" description="Renseignez l'offre, les tarifs et la caution. Vous pourrez ajouter d'autres photos ensuite." />
      <ProductForm
        categories={categories.map((c) => ({ id: c.id, name: c.name, children: c.children.map((ch) => ({ id: ch.id, name: ch.name })) }))}
        cities={cities.map((c) => ({ id: c.id, name: c.name }))}
        defaults={{ name: "", description: "", conditions: "", categoryId: "", cityId: cities.find((c) => c.id)?.id ?? "", unitPrice: 0, stockQuantity: 0, depositAmount: 0, refundPrice: 0, minDays: 1, maxDays: null, allowsExtraBilling: settings["deposit.extra_billing_default"] }}
        canPublish={actor.lenderStatus === "APPROVED"}
        depositPercent={depositPercentFrom(settings)}
          depositFloor={depositFloorFrom(settings)}
      />
    </>
  );
}
