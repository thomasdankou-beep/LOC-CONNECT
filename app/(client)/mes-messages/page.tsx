import type { Metadata } from "next";
import { pageClient } from "@/lib/auth/page";
import { ProductInbox } from "@/features/product-messages/views";

export const metadata: Metadata = { title: "Mes messages", robots: { index: false } };

export default async function Page({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const actor = await pageClient("/mes-messages");
  return <ProductInbox actor={actor} page={Number((await searchParams).page) || 1} />;
}
