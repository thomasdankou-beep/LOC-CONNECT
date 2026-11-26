import type { Metadata } from "next";
import { pageLender } from "@/lib/auth/page";
import { ProductInbox } from "@/features/product-messages/views";

export const metadata: Metadata = { title: "Messages clients", robots: { index: false } };

export default async function Page({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const actor = await pageLender("PRODUCT_MESSAGE_MANAGE");
  return <ProductInbox actor={actor} page={Number((await searchParams).page) || 1} />;
}
