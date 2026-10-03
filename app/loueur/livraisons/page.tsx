import type { Metadata } from "next";
import Link from "next/link";
import type { DeliveryStatus } from "@prisma/client";
import { can } from "@/lib/auth/actor";
import { pageLender } from "@/lib/auth/page";
import { formatDate } from "@/lib/dates";
import { formatFcfa } from "@/lib/money";
import { DELIVERY_STATUS } from "@/lib/labels";
import { listLenderDeliveries } from "@/services/deliveries";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/states";
import { Tabs } from "@/components/ui/misc";
import { Pagination } from "@/components/ui/pagination";
import { MapPin, Phone, Truck } from "@/components/ui/icons";
import { DeliveryControls } from "@/features/lender/delivery-actions";
import { toISODate } from "@/lib/dates";

export const metadata: Metadata = { title: "Livraisons", robots: { index: false } };

const TABS: { key: string; label: string; status?: DeliveryStatus }[] = [
  { key: "all", label: "Toutes" },
  { key: "PENDING", label: "À planifier", status: "PENDING" },
  { key: "PREPARING", label: "En préparation", status: "PREPARING" },
  { key: "OUT_FOR_DELIVERY", label: "En route", status: "OUT_FOR_DELIVERY" },
  { key: "DELIVERED", label: "Livrées", status: "DELIVERED" },
  { key: "FAILED", label: "Échecs", status: "FAILED" },
];

export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string; page?: string }> }) {
  const actor = await pageLender("DELIVERY_VIEW");
  const sp = await searchParams;
  const tab = TABS.find((t) => t.key === sp.tab) ?? TABS[0];
  const result = await listLenderDeliveries(actor.lenderId, { status: tab.status, page: Number(sp.page) || 1 });
  const perms = { update: can(actor, "DELIVERY_UPDATE"), proof: can(actor, "DELIVERY_PROOF_CREATE") };

  return (
    <>
      <PageHeader title="Livraisons" description="Planifiez, suivez et prouvez chaque livraison. Le client est prévenu à chaque changement de statut." />
      <Tabs items={TABS.map((t) => ({ key: t.key, label: t.label, href: `/loueur/livraisons?tab=${t.key}` }))} active={tab.key} />
      {result.rows.length === 0 ? (
        <EmptyState icon={<Truck size={28} />} title="Aucune livraison" description="Les commandes avec livraison apparaissent ici une fois payées." />
      ) : (
        <ul className="space-y-4">
          {result.rows.map((d) => (
            <li key={d.id}>
              <Card className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <Link href={`/loueur/reservations/${d.reservation.id}`} className="font-mono text-sm font-semibold text-royal-ink hover:underline">{d.reservation.reference}</Link>
                      <StatusBadge entry={DELIVERY_STATUS[d.status]} />
                    </div>
                    <p className="mt-2 text-sm text-ink">{d.reservation.items.map((i) => `${i.quantity} x ${i.productName}`).join(", ")}</p>
                    <p className="mt-1 flex items-start gap-1.5 text-sm text-muted"><MapPin size={14} className="mt-0.5 shrink-0" /> {d.address ?? "Adresse non renseignée"}{d.zone ? `, ${d.zone}` : ""}</p>
                    <p className="mt-0.5 text-sm text-muted">{d.reservation.client.firstName} {d.reservation.client.lastName}{d.reservation.client.phone ? <> · <a href={`tel:${d.reservation.client.phone}`} className="inline-flex items-center gap-1 text-royal-ink hover:underline"><Phone size={12} /> {d.reservation.client.phone}</a></> : null}</p>
                  </div>
                  <div className="text-right text-sm">
                    <p className="font-medium text-ink">{d.scheduledDate ? formatDate(d.scheduledDate) : "Date à planifier"}</p>
                    {d.slotStart && <p className="text-muted">{d.slotStart} à {d.slotEnd}</p>}
                    <p className="mt-1 text-muted">Frais : {formatFcfa(d.fee)}</p>
                    {d.proofs.length > 0 && <p className="mt-1 text-muted">{d.proofs.length} preuve{d.proofs.length > 1 ? "s" : ""}</p>}
                  </div>
                </div>
                {d.notes && <p className="mt-3 rounded-control bg-surface-2/60 px-3 py-2 text-sm text-muted">{d.notes}</p>}
                <div className="mt-4 border-t border-line pt-4">
                  <DeliveryControls id={d.id} status={d.status} scheduledDate={d.scheduledDate ? toISODate(d.scheduledDate) : null} slotStart={d.slotStart} slotEnd={d.slotEnd} itemsReady={d.reservation.items.some((i) => i.status === "READY")} perms={perms} />
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
      <Pagination page={result.page} totalPages={result.totalPages} basePath="/loueur/livraisons" params={{ tab: tab.key }} />
    </>
  );
}
