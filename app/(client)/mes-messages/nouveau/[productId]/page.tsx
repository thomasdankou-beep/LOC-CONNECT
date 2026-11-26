import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/card";
import { ArrowLeft } from "@/components/ui/icons";
import { ProductMessageForm } from "@/features/product-messages/message-form";
import { pageClient } from "@/lib/auth/page";
import { getMessageDraft } from "@/services/product-messages";

export const metadata: Metadata = { title: "Contacter le loueur", robots: { index: false } };

export default async function Page({ params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params;
  const actor = await pageClient("/mes-messages/nouveau/" + productId);
  const draft = await getMessageDraft(actor, productId);
  if (!draft) notFound();
  if (draft.existingId) redirect("/mes-messages/" + draft.existingId);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={draft.product.name} description={"Écrire à " + draft.product.lender.companyName}
        back={<Link href={"/produits/" + draft.product.slug} className="mb-2 inline-flex items-center gap-1 text-sm text-royal-ink"><ArrowLeft size={16} /> Revoir l’article</Link>} />
      <ProductMessageForm target={{ productId }} basePath="/mes-messages" />
    </div>
  );
}
