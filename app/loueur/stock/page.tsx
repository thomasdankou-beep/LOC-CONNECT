import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { can } from "@/lib/auth/actor";
import { pageLender } from "@/lib/auth/page";
import { formatDateTime } from "@/lib/dates";
import { PRODUCT_STATUS } from "@/lib/labels";
import { stockOverview } from "@/services/products";
import { Card, CardHeader, PageHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/badge";
import { FormAction } from "@/components/ui/action";

export const metadata: Metadata = { title: "Stock", robots: { index: false } };

const REASONS: Record<string, string> = { PURCHASE: "Achat", REPAIR: "Réparation", LOSS: "Perte", CORRECTION: "Correction", RETURN_TO_STOCK: "Retour en stock" };

export default async function Page() {
  const actor = await pageLender("STOCK_VIEW");
  const [rows, movements] = await Promise.all([
    stockOverview(actor.lenderId),
    db.stockMovement.findMany({ where: { product: { lenderId: actor.lenderId } }, include: { product: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 12 }),
  ]);
  const canAdjust = can(actor, "STOCK_ADJUST");
  const canBlock = can(actor, "CALENDAR_MANAGE");

  return (
    <>
      <PageHeader title="Stock" description="Disponibilité aujourd'hui : stock physique moins les réservations, les paniers en cours de paiement et les blocages." />
      <DataTable
        rows={rows}
        rowKey={(p) => p.id}
        empty={{ title: "Aucun produit", description: "Créez un produit pour suivre son stock." }}
        columns={[
          { header: "Produit", cell: (p) => <Link href={`/loueur/produits/${p.id}`} className="font-medium text-ink hover:underline">{p.name}</Link> },
          { header: "Statut", cell: (p) => <StatusBadge entry={PRODUCT_STATUS[p.status]} /> },
          { header: "Physique", align: "right", cell: (p) => p.stockQuantity },
          { header: "Réservé", align: "right", cell: (p) => p.reserved },
          { header: "En paiement", align: "right", cell: (p) => p.held },
          { header: "Bloqué", align: "right", cell: (p) => p.blocked },
          { header: "Disponible", align: "right", cell: (p) => <span className={p.available === 0 ? "font-semibold text-danger" : "font-semibold text-success"}>{p.available}</span> },
          {
            header: "Actions",
            cell: (p) => (
              <div className="flex gap-2">
                {canAdjust && (
                  <FormAction
                    endpoint={`/api/products/${p.id}/stock`}
                    label="Ajuster"
                    title={`Ajuster le stock : ${p.name}`}
                    description={`Stock actuel : ${p.stockQuantity}. Utilisez une valeur négative pour retirer des unités. Le stock ne peut pas descendre sous les quantités déjà réservées.`}
                    fields={[
                      { name: "delta", label: "Variation", type: "number", required: true, hint: "Ex : 2 ou -1" },
                      { name: "reason", label: "Motif", type: "select", required: true, options: Object.entries(REASONS).map(([value, label]) => ({ value, label })), defaultValue: "CORRECTION" },
                      { name: "note", label: "Note", type: "textarea" },
                    ]}
                    submitLabel="Enregistrer"
                    success="Stock mis à jour"
                  />
                )}
                {canBlock && (
                  <FormAction
                    endpoint={`/api/products/${p.id}/availability`}
                    label="Bloquer"
                    title={`Bloquer des unités : ${p.name}`}
                    description="Retire des unités à la location sur une période (maintenance, usage interne). Fin exclue."
                    fields={[
                      { name: "startDate", label: "Début", type: "date", required: true },
                      { name: "endDate", label: "Fin", type: "date", required: true },
                      { name: "quantity", label: "Quantité", type: "number", required: true, min: 1, defaultValue: 1 },
                      { name: "reason", label: "Motif" },
                    ]}
                    submitLabel="Bloquer"
                    success="Période bloquée"
                  />
                )}
              </div>
            ),
          },
        ]}
      />

      <Card className="mt-8">
        <CardHeader title="Derniers mouvements" description="Chaque ajustement est journalisé" />
        {movements.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted">Aucun mouvement de stock enregistré.</p>
        ) : (
          <ul className="divide-y divide-line text-sm">
            {movements.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                <div><p className="font-medium text-ink">{m.product.name}</p><p className="text-xs text-muted">{REASONS[m.reason] ?? m.reason}{m.note ? ` · ${m.note}` : ""} · {formatDateTime(m.createdAt)}</p></div>
                <p className="tabular-nums text-ink">{m.previousQty} vers {m.newQty} <span className={m.delta > 0 ? "text-success" : "text-danger"}>({m.delta > 0 ? "+" : ""}{m.delta})</span></p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
