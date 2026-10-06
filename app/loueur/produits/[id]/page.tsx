import type { Metadata } from "next";
import { getSettings } from "@/lib/settings";
import { depositFloorFrom, depositPercentFrom } from "@/services/pricing";
import Link from "next/link";
import { notFound } from "next/navigation";
import { can } from "@/lib/auth/actor";
import { pageLender } from "@/lib/auth/page";
import { AppError } from "@/lib/errors";
import { formatDate, formatDateTime } from "@/lib/dates";
import { formatFcfa } from "@/lib/money";
import { PRODUCT_STATUS } from "@/lib/labels";
import { getLenderProduct } from "@/services/products";
import { listCategoryTree, listCities } from "@/services/catalog";
import { Card, CardHeader, PageHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { Notice } from "@/components/ui/states";
import { ActionButton, FormAction } from "@/components/ui/action";
import { Photo } from "@/components/ui/photo";
import { ArrowLeft } from "@/components/ui/icons";
import { ProductForm } from "@/features/lender/product-form";
import { PhotoManager } from "@/features/lender/photo-manager";

export const metadata: Metadata = { title: "Modifier le produit", robots: { index: false } };

const REASONS: Record<string, string> = { INITIAL: "Stock initial", PURCHASE: "Achat", REPAIR: "Réparation", LOSS: "Perte", CORRECTION: "Correction", RETURN_TO_STOCK: "Retour en stock", LOST: "Perdu en location" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await pageLender("PRODUCT_VIEW");
  const product = await getLenderProduct(actor.lenderId, id).catch((e) => {
    if (e instanceof AppError) return null;
    throw e;
  });
  if (!product) notFound();
  const [categories, cities, settings] = await Promise.all([listCategoryTree(), listCities(), getSettings()]);
  const canUpdate = can(actor, "PRODUCT_UPDATE");

  return (
    <>
      <Link href="/loueur/produits" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"><ArrowLeft size={16} /> Mes produits</Link>
      <PageHeader
        title={product.name}
        description={<span className="inline-flex flex-wrap items-center gap-2"><StatusBadge entry={PRODUCT_STATUS[product.status]} /> <Link href={`/produits/${product.slug}`} className="text-royal-ink hover:underline">Voir la fiche publique</Link></span>}
        actions={
          <>
            {canUpdate && ["DRAFT", "REJECTED"].includes(product.status) && <ActionButton endpoint={`/api/products/${product.id}/status`} body={{ action: "publish" }} label="Soumettre à la modération" variant="primary" size="md" success="Produit soumis" />}
            {canUpdate && product.status === "INACTIVE" && <ActionButton endpoint={`/api/products/${product.id}/status`} body={{ action: "reactivate" }} label="Réactiver" variant="primary" size="md" success="Produit réactivé" />}
            {can(actor, "PRODUCT_DELETE") && product.status === "PUBLISHED" && <ActionButton endpoint={`/api/products/${product.id}/status`} body={{ action: "deactivate" }} label="Désactiver" size="md" confirm={{ title: "Désactiver ce produit ?", description: "Il ne sera plus visible dans le catalogue. Les réservations existantes ne sont pas affectées." }} success="Produit désactivé" />}
          </>
        }
      />
      {product.status === "REJECTED" && product.rejectionReason && <div className="mb-6"><Notice tone="danger" title="Produit refusé par la modération">{product.rejectionReason}</Notice></div>}

      {canUpdate ? (
        <ProductForm
          depositPercent={depositPercentFrom(settings)}
          depositFloor={depositFloorFrom(settings)}
          categories={categories.map((c) => ({ id: c.id, name: c.name, children: c.children.map((ch) => ({ id: ch.id, name: ch.name })) }))}
          cities={cities.map((c) => ({ id: c.id, name: c.name }))}
          defaults={{ id: product.id, name: product.name, description: product.description, conditions: product.conditions ?? "", categoryId: product.categoryId, cityId: product.cityId, unitPrice: product.unitPrice, stockQuantity: product.stockQuantity, depositAmount: product.depositAmount, refundPrice: product.refundPrice, minDays: product.minDays, maxDays: product.maxDays, allowsExtraBilling: product.allowsExtraBilling }}
          canPublish={false}
        />
      ) : (
        <Notice tone="info">Votre rôle permet de consulter ce produit, pas de le modifier.</Notice>
      )}

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Photos" description="La première photo est la vignette du catalogue." />
          <div className="p-5">
            {canUpdate ? <PhotoManager productId={product.id} photos={product.photos.map((p) => ({ id: p.id, url: p.url }))} /> : <div className="grid grid-cols-3 gap-3">{product.photos.map((p) => <Photo key={p.id} src={p.url} alt="" w={300} h={225} className="aspect-[4/3] rounded-control" />)}</div>}
          </div>
        </Card>

        <Card>
          <CardHeader title="Stock" description={`${product.stockQuantity} unité${product.stockQuantity > 1 ? "s" : ""} au total`} action={can(actor, "STOCK_ADJUST") && <FormAction endpoint={`/api/products/${product.id}/stock`} label="Ajuster le stock" title="Ajuster le stock" description="Le stock ne peut pas descendre sous les quantités déjà réservées." submitLabel="Valider" fields={[
            { name: "delta", label: "Variation (positive ou négative)", type: "number", required: true },
            { name: "reason", label: "Motif", type: "select", required: true, options: [{ value: "PURCHASE", label: "Achat" }, { value: "REPAIR", label: "Réparation terminée" }, { value: "LOSS", label: "Perte ou casse" }, { value: "CORRECTION", label: "Correction d'inventaire" }, { value: "RETURN_TO_STOCK", label: "Retour en stock" }] },
            { name: "note", label: "Note (facultatif)", type: "text" },
          ]} success="Stock ajusté" />} />
          <ul className="divide-y divide-line">
            {product.stockMoves.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                <div><p className="text-ink">{REASONS[m.reason] ?? m.reason}{m.note ? ` · ${m.note}` : ""}</p><p className="text-xs text-muted">{formatDateTime(m.createdAt)}</p></div>
                <p className="tabular-nums"><span className={m.delta >= 0 ? "text-success" : "text-danger"}>{m.delta > 0 ? "+" : ""}{m.delta}</span> <span className="text-muted">→ {m.newQty}</span></p>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader title="Blocages de disponibilité" description="Retirez une quantité de la location sur une période (maintenance, usage interne)." action={can(actor, "CALENDAR_MANAGE") && <FormAction endpoint={`/api/products/${product.id}/availability`} label="Bloquer une période" title="Bloquer une période" fields={[
            { name: "startDate", label: "Début", type: "date", required: true },
            { name: "endDate", label: "Fin (jour de reprise)", type: "date", required: true },
            { name: "quantity", label: "Quantité retirée", type: "number", required: true, min: 1, defaultValue: 1 },
            { name: "reason", label: "Motif", type: "text" },
          ]} success="Période bloquée" />} />
          {product.blocks.length === 0 ? <p className="p-6 text-sm text-muted">Aucun blocage à venir.</p> : (
            <ul className="divide-y divide-line">
              {product.blocks.map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                  <div><p className="text-ink">{b.quantity} unité{b.quantity > 1 ? "s" : ""} · {formatDate(b.startDate)} au {formatDate(b.endDate)}</p>{b.reason && <p className="text-xs text-muted">{b.reason}</p>}</div>
                  {can(actor, "CALENDAR_MANAGE") && <ActionButton endpoint={`/api/products/${product.id}/availability?blockId=${b.id}`} method="DELETE" label="Lever" success="Blocage levé" />}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Historique des prix" />
          {product.priceHistory.length === 0 ? <p className="p-6 text-sm text-muted">Aucune modification de prix.</p> : (
            <ul className="divide-y divide-line">
              {product.priceHistory.map((h) => <li key={h.id} className="flex justify-between px-5 py-3 text-sm"><span className="text-muted">{formatDateTime(h.createdAt)}</span><span className="tabular-nums text-ink">{formatFcfa(h.oldPrice)} → {formatFcfa(h.newPrice)}</span></li>)}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
