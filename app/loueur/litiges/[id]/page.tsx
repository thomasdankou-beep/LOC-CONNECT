import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { pageLender } from "@/lib/auth/page";
import { AppError } from "@/lib/errors";
import { getDisputeForActor } from "@/services/disputes";
import { DisputeDetail } from "@/features/disputes/detail";
import { ArrowLeft } from "@/components/ui/icons";

export const metadata: Metadata = { title: "Détail du litige", robots: { index: false } };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await pageLender("DISPUTE_VIEW");
  const dispute = await getDisputeForActor(actor, id).catch((e) => {
    if (e instanceof AppError) return null;
    throw e;
  });
  if (!dispute) notFound();
  return (
    <>
      <Link href="/loueur/litiges" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"><ArrowLeft size={16} /> Litiges</Link>
      <h1 className="mb-6 text-2xl font-semibold text-ink sm:text-3xl">Litige <span className="font-mono">{dispute.reference}</span></h1>
      <DisputeDetail dispute={dispute} />
    </>
  );
}
