import type { Metadata } from "next";
import { db } from "@/lib/db";
import { pageAdmin } from "@/lib/auth/page";
import { formatDate } from "@/lib/dates";
import { formatFcfa } from "@/lib/money";
import { listSubscriptions } from "@/services/admin";
import { PageHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { SubscriptionForm } from "@/features/admin/finance-actions";

export const metadata: Metadata = { title: "Abonnements", robots: { index: false } };

const PLAN = { FREE: "Gratuite", PRO: "Pro", PREMIUM: "Premium" } as const;

export default async function Page() {
  const actor = await pageAdmin("ADMIN_SUBSCRIPTIONS");
  const [subs, lenders] = await Promise.all([listSubscriptions(actor), db.lender.findMany({ where: { status: "APPROVED" }, select: { id: true, companyName: true }, orderBy: { companyName: "asc" } })]);
  return (
    <>
      <PageHeader title="Abonnements" description="Formules des loueurs. Une seule formule est active par loueur ; l'historique est conservé." actions={<SubscriptionForm lenders={lenders.map((l) => ({ id: l.id, name: l.companyName }))} />} />
      <DataTable
        rows={subs}
        rowKey={(s) => s.id}
        empty={{ title: "Aucun abonnement", description: "Attribuez une formule à un loueur pour commencer." }}
        columns={[
          { header: "Loueur", cell: (s) => s.lender.companyName },
          { header: "Formule", cell: (s) => PLAN[s.plan] },
          { header: "Prix mensuel", align: "right", cell: (s) => formatFcfa(s.price) },
          { header: "Début", cell: (s) => formatDate(s.startsAt) },
          { header: "Fin", cell: (s) => (s.endsAt ? formatDate(s.endsAt) : "Sans échéance") },
          { header: "Statut", cell: (s) => <Badge tone={s.status === "ACTIVE" ? "success" : "neutral"}>{s.status === "ACTIVE" ? "Actif" : s.status === "CANCELLED" ? "Clôturé" : "Expiré"}</Badge> },
        ]}
      />
    </>
  );
}
