import type { Metadata } from "next";
import { pageLender } from "@/lib/auth/page";
import { PageHeader } from "@/components/ui/card";
import { InvoiceList } from "@/features/invoices/invoice-list";

export const metadata: Metadata = { title: "Factures", robots: { index: false } };

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; page?: string }> }) {
  const actor = await pageLender(["FINANCE_VIEW", "DEPOSIT_VIEW"]);
  return (
    <>
      <PageHeader title="Factures" description="Factures émises en votre nom par LOC'CONNECT : locations, casse et perte, avoirs." />
      <InvoiceList actor={actor} basePath="/loueur/factures" sp={await searchParams} />
    </>
  );
}
