import type { Metadata } from "next";
import Link from "next/link";
import { can } from "@/lib/auth/actor";
import { pageLender } from "@/lib/auth/page";
import { formatDate, formatDateTime } from "@/lib/dates";
import { getSettings } from "@/lib/settings";
import { formatFcfa } from "@/lib/money";
import { RESERVATION_STATUS, RETURN_CONDITION, RETURN_REPORT_STATUS } from "@/lib/labels";
import { listLenderReturns } from "@/services/returns";
import { Card, CardHeader, PageHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/states";
import { ReturnReportButton } from "@/features/lender/return-form";
import { ArrowCounterClockwise } from "@/components/ui/icons";

export const metadata: Metadata = { title: "Retours", robots: { index: false } };

export default async function Page({ searchParams }: { searchParams: Promise<{ item?: string }> }) {
  const actor = await pageLender("RETURN_VIEW");
  const sp = await searchParams;
  const [{ toReturn, reports }, settings] = await Promise.all([listLenderReturns(actor.lenderId), getSettings()]);
  const canCreate = can(actor, "RETURN_CREATE");
  const canPhoto = can(actor, "RETURN_EVIDENCE_CREATE");
  const canDamage = can(actor, "DAMAGE_REPORT_CREATE");
  const today = new Date();

  return (
    <>
      <PageHeader title="Retours" description="Constatez l'état du matériel à la restitution. Sans dommage, la caution est rendue immédiatement." />

      <Card className="mb-8">
        <CardHeader title="À constater" description="Locations en cours ou en attente de retour" />
        {toReturn.length === 0 ? (
          <EmptyState className="rounded-none border-0" icon={<ArrowCounterClockwise size={28} />} title="Aucun retour attendu" description="Les locations dont le matériel doit être restitué apparaissent ici." />
        ) : (
          <ul className="divide-y divide-line">
            {toReturn.map((i) => {
              const late = i.endDate < today;
              return (
                <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                  <div className="min-w-0">
                    <p className="font-medium text-ink">{i.quantity} x {i.productName}</p>
                    <p className="text-sm text-muted"><Link href={`/loueur/reservations/${i.reservation.id}`} className="font-mono text-royal-ink hover:underline">{i.reservation.reference}</Link> · {i.reservation.client.firstName} {i.reservation.client.lastName.slice(0, 1)}. · retour prévu le {formatDate(i.endDate)}{late ? " (en retard)" : ""}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge entry={RESERVATION_STATUS[i.status]} />
                    {canCreate && i.deposit && (
                      <ReturnReportButton
                        item={{ id: i.id, productName: i.productName, quantity: i.quantity, refundPrice: i.refundPrice, depositAmount: i.deposit.amount, allowsExtraBilling: i.allowsExtraBilling, reference: i.reservation.reference }}
                        evidenceRequired={settings["return.evidence_required"]}
                        canPhoto={canPhoto}
                        canDamage={canDamage}
                        defaultOpen={sp.item === i.id}
                      />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <h2 className="mb-3 text-lg font-semibold text-ink">Constats récents</h2>
      <DataTable
        rows={reports}
        rowKey={(r) => r.id}
        empty={{ title: "Aucun constat", description: "Vos constats de retour apparaissent ici." }}
        columns={[
          { header: "Réservation", cell: (r) => <Link href={`/loueur/reservations/${r.item.reservation.id}`} className="font-mono text-[13px] font-medium text-royal-ink hover:underline">{r.item.reservation.reference}</Link> },
          { header: "Produit", cell: (r) => <span className="block max-w-56 truncate">{r.item.productName}</span> },
          { header: "État", cell: (r) => RETURN_CONDITION[r.condition] },
          { header: "Retenue", align: "right", cell: (r) => formatFcfa(r.withheldAmount) },
          { header: "Date", cell: (r) => formatDateTime(r.createdAt) },
          { header: "Statut", cell: (r) => <StatusBadge entry={RETURN_REPORT_STATUS[r.status]} /> },
        ]}
      />
    </>
  );
}
