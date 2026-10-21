import type { Metadata } from "next";
import { db } from "@/lib/db";
import { pageAdmin } from "@/lib/auth/page";
import { formatDateTime } from "@/lib/dates";
import { PAYOUT_METHOD } from "@/lib/labels";
import { listValidations } from "@/services/admin";
import { Card, PageHeader } from "@/components/ui/card";
import { EmptyState, Notice } from "@/components/ui/states";
import { ValidationDecision } from "@/features/admin/finance-actions";
import { IdentificationCard } from "@/components/ui/icons";

export const metadata: Metadata = { title: "Validations", robots: { index: false } };

export default async function Page() {
  const actor = await pageAdmin("ADMIN_PAYOUTS");
  const items = await listValidations(actor);
  const lenders = await db.lender.findMany({ where: { id: { in: items.map((i) => i.entityId) } }, select: { id: true, companyName: true, payoutMethod: true, payoutAccount: true } });
  return (
    <>
      <PageHeader title="Validations renforcées" description="Tout changement de coordonnées de versement exige l'accord d'un administrateur autre que le demandeur." />
      {items.length === 0 ? (
        <EmptyState icon={<IdentificationCard size={28} />} title="Rien à valider" description="Les demandes de changement de coordonnées de versement apparaissent ici." />
      ) : (
        <ul className="space-y-4">
          {items.map((v) => {
            const lender = lenders.find((l) => l.id === v.entityId);
            const p = v.payload as { method: string; account: string };
            return (
              <li key={v.id}>
                <Card className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold text-ink">{lender?.companyName ?? "Loueur"}</p>
                      <p className="text-sm text-muted">Demandé par {v.requestedBy.firstName} {v.requestedBy.lastName} le {formatDateTime(v.requestedAt)}</p>
                      <dl className="mt-3 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
                        <div><dt className="text-xs uppercase tracking-wide text-muted">Actuel</dt><dd className="text-ink">{lender?.payoutMethod ? `${PAYOUT_METHOD[lender.payoutMethod] ?? lender.payoutMethod} · ${lender.payoutAccount}` : "Aucun"}</dd></div>
                        <div><dt className="text-xs uppercase tracking-wide text-muted">Demandé</dt><dd className="font-medium text-ink">{PAYOUT_METHOD[p.method] ?? p.method} · {p.account}</dd></div>
                      </dl>
                    </div>
                    {v.requestedById === actor.userId ? <Notice tone="info">Vous ne pouvez pas valider votre propre demande.</Notice> : <ValidationDecision id={v.id} />}
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
