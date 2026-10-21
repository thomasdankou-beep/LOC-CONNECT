import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { pageAdmin } from "@/lib/auth/page";
import { canSeeInvoices } from "@/services/invoices";
import { PageHeader } from "@/components/ui/card";
import { InvoiceList } from "@/features/invoices/invoice-list";

export const metadata: Metadata = { title: "Factures", robots: { index: false } };

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; page?: string }> }) {
  const actor = await pageAdmin();
  if (!canSeeInvoices(actor)) redirect("/admin?denied=1");
  return (
    <>
      <PageHeader title="Factures et avoirs" description="Tous les documents émis au nom des loueurs. La numérotation est continue, sans trou, par année." />
      <InvoiceList actor={actor} basePath="/admin/factures" sp={await searchParams} />
    </>
  );
}
