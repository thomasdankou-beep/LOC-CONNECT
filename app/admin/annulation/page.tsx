import type { Metadata } from "next";
import { pageAdmin } from "@/lib/auth/page";
import { can } from "@/lib/auth/actor";
import { getCancellationPolicy } from "@/services/admin";
import { PageHeader } from "@/components/ui/card";
import { Notice } from "@/components/ui/states";
import { PolicyEditor } from "@/features/admin/policy-editor";

export const metadata: Metadata = { title: "Politique d'annulation", robots: { index: false } };

export default async function Page() {
  const actor = await pageAdmin("ADMIN_SETTINGS");
  const policy = await getCancellationPolicy(actor);
  return (
    <>
      <PageHeader title="Politique d'annulation" description="Pourcentage de la location remboursé selon le délai restant avant le début. Appliquée ligne par ligne à chaque annulation." />
      <div className="mb-6"><Notice tone="info">Un changement ne concerne que les annulations futures. Pour chaque remboursement déjà effectué, la règle appliquée à l&apos;époque est conservée dans son historique.</Notice></div>
      <PolicyEditor initial={(policy?.rules ?? []).map((r) => ({ minHoursBefore: r.minHoursBefore, refundPercent: r.refundPercent }))} canEdit={can(actor, "ADMIN_SETTINGS")} />
    </>
  );
}
