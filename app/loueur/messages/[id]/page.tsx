import type { Metadata } from "next";
import { pageLender } from "@/lib/auth/page";
import { ProductThread } from "@/features/product-messages/views";

export const metadata: Metadata = { title: "Conversation sur un article", robots: { index: false } };

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ page?: string }> }) {
  const { id } = await params;
  const actor = await pageLender("PRODUCT_MESSAGE_MANAGE");
  return <ProductThread actor={actor} id={id} page={Number((await searchParams).page) || 1} />;
}
