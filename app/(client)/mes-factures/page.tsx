import type { Metadata } from "next";
import { requireClient } from "@/lib/auth/actor";
import { PageHeader } from "@/components/ui/card";
import { InvoiceList } from "@/features/invoices/invoice-list";

export const metadata: Metadata = { title: "Mes factures", robots: { index: false } };

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; page?: string }> }) {
  const actor = await requireClient();
  return (
    <>
      <PageHeader title="Mes factures" description="Factures de location, factures de casse et perte et avoirs. Ouvrez un document pour l'imprimer ou l'enregistrer en PDF." />
      <InvoiceList actor={actor} basePath="/mes-factures" sp={await searchParams} />
    </>
  );
}
