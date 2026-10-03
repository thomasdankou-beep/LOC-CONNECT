import type { Metadata } from "next";
import Link from "next/link";
import { pageAdmin } from "@/lib/auth/page";
import { can } from "@/lib/auth/actor";
import { formatFcfa } from "@/lib/money";
import { commissionSummary } from "@/services/admin";
import { LinkButton } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { KpiCard } from "@/components/ui/misc";
import { Percent } from "@/components/ui/icons";

export const metadata: Metadata = { title: "Commissions", robots: { index: false } };

export default async function Page() {
  const actor = await pageAdmin("ADMIN_COMMISSIONS");
  const s = await commissionSummary(actor);
  const total = s.rows.reduce((a, r) => a + (r._sum.commissionAmount ?? 0), 0);
  const base = s.rows.reduce((a, r) => a + (r._sum.rentalAmount ?? 0), 0);
  return (
    <>
      <PageHeader title="Commissions" description="Commission perçue par loueur. Le taux est figé à chaque réservation : changer un taux n'affecte jamais les réservations passées." actions={can(actor, "ADMIN_SETTINGS") && <LinkButton variant="secondary" href="/admin/parametres">Taux par défaut</LinkButton>} />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <KpiCard primary label="Commission totale perçue" value={formatFcfa(total)} icon={<Percent size={20} />} />
        <KpiCard label="Base de calcul (locations)" value={formatFcfa(base)} hint={base > 0 ? `Taux effectif moyen : ${((total / base) * 100).toFixed(1).replace(".", ",")} %` : undefined} />
        <KpiCard label="Taux par défaut" value={`${s.defaultRateBps / 100} %`} hint="Modifiable dans les paramètres" />
      </div>
      <DataTable
        rows={s.rows}
        rowKey={(r) => r.lenderId}
        empty={{ title: "Aucune commission", description: "Les commissions apparaissent après les premiers paiements." }}
        columns={[
          { header: "Loueur", cell: (r) => (r.lender ? <Link href={`/admin/loueurs?q=${encodeURIComponent(r.lender.companyName)}`} className="font-medium text-ink hover:underline">{r.lender.companyName}</Link> : r.lenderId) },
          { header: "Taux appliqué", cell: (r) => (r.lender?.commissionRateBps == null ? `${s.defaultRateBps / 100} % (défaut)` : <Badge tone="info">{r.lender.commissionRateBps / 100} % spécifique</Badge>) },
          { header: "Paiements", align: "right", cell: (r) => r._count },
          { header: "Locations", align: "right", cell: (r) => formatFcfa(r._sum.rentalAmount ?? 0) },
          { header: "Livraisons", align: "right", cell: (r) => formatFcfa(r._sum.deliveryAmount ?? 0) },
          { header: "Commission", align: "right", cell: (r) => formatFcfa(r._sum.commissionAmount ?? 0) },
          { header: "Part nette loueur", align: "right", cell: (r) => formatFcfa(r._sum.netAmount ?? 0) },
        ]}
      />
    </>
  );
}
