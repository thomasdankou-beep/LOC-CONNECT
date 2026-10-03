import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { pageAdmin } from "@/lib/auth/page";
import { AppError } from "@/lib/errors";
import { getDisputeForActor } from "@/services/disputes";
import { DisputeDetail } from "@/features/disputes/detail";
import { DisputeAdminActions } from "@/features/admin/dispute-actions";
import { ArrowLeft } from "@/components/ui/icons";

export const metadata: Metadata = { title: "Litige", robots: { index: false } };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await pageAdmin("ADMIN_DISPUTES");
  const dispute = await getDisputeForActor(actor, id).catch((e) => {
    if (e instanceof AppError) return null;
    throw e;
  });
  if (!dispute) notFound();
  const report = dispute.item?.returnReport;
  return (
    <>
      <Link href="/admin/litiges" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"><ArrowLeft size={16} /> Litiges</Link>
      <h1 className="mb-6 text-2xl font-semibold text-ink sm:text-3xl">Litige <span className="font-mono">{dispute.reference}</span></h1>
      <DisputeDetail dispute={dispute} actions={<DisputeAdminActions id={dispute.id} status={dispute.status} hasReport={Boolean(report && report.status === "CONTESTED")} disputed={dispute.disputedAmount} />} />
    </>
  );
}
