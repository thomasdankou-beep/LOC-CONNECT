import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getActor } from "@/lib/auth/actor";
import { formatDate, parseDate } from "@/lib/dates";
import { formatFcfa } from "@/lib/money";
import { getCart } from "@/services/cart";
import { Card } from "@/components/ui/card";
import { Photo } from "@/components/ui/photo";
import { EmptyState, Notice } from "@/components/ui/states";
import { LinkButton } from "@/components/ui/button";
import { HandCoins, ShoppingCart, Storefront, ShieldCheck, WarningCircle } from "@/components/ui/icons";
import { Badge } from "@/components/ui/badge";
import { PAYMENT_MODE } from "@/lib/labels";
import { getSettings } from "@/lib/settings";
import { depositPercentFrom } from "@/services/pricing";
import { CartLineControls } from "@/features/cart/cart-line-controls";

export const metadata: Metadata = { title: "Mon panier", robots: { index: false } };

export default async function CartPage() {
  const actor = await getActor();
  if (!actor) redirect("/connexion?next=/panier");
  if (actor.accountType !== "CLIENT") {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <Notice tone="info">Le panier est réservé aux comptes client. Connectez-vous avec un compte client pour réserver.</Notice>
      </div>
    );
  }
  const cart = await getCart(actor.userId);
  const depositPercent = depositPercentFrom(await getSettings());

  if (cart.lines.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <EmptyState icon={<ShoppingCart size={26} />} title="Votre panier est vide" description="Ajoutez du matériel de un ou plusieurs loueurs, choisissez vos dates et payez en une seule fois." action={<LinkButton href="/catalogue">Parcourir le catalogue</LinkButton>} />
      </div>
    );
  }

  const days = (a: string, b: string) => Math.round((parseDate(b).getTime() - parseDate(a).getTime()) / 86_400_000);

  return (
    <div className="mx-auto max-w-7xl px-4 pb-4 pt-10 sm:px-6">
      <h1 className="text-3xl font-semibold text-ink sm:text-4xl">Mon panier</h1>
      <p className="mt-2 text-muted">{cart.itemCount} article{cart.itemCount > 1 ? "s" : ""} chez {cart.groups.length} loueur{cart.groups.length > 1 ? "s" : ""}. Un seul paiement pour toute la commande.</p>

      {cart.issues > 0 && (
        <div className="mt-6" role="alert">
          <Notice tone="warning" title="Certaines lignes ne sont plus réservables">
            Ajustez la quantité ou retirez les lignes signalées pour continuer. La disponibilité est revérifiée à chaque étape.
          </Notice>
        </div>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_24rem]">
        <div className="space-y-6">
          {cart.groups.map((g) => (
            <Card key={g.lenderId} className="overflow-hidden">
              <div className="flex items-center justify-between gap-3 border-b border-line bg-surface-2/50 px-5 py-3.5">
                <h2 className="flex flex-wrap items-center gap-2 text-base font-semibold text-ink"><Storefront size={18} className="text-royal-ink" /> {g.lenderName} <Badge tone={g.paymentMode === "DEPOSIT_CASH" ? "warning" : "success"}>{PAYMENT_MODE[g.paymentMode].short}</Badge></h2>
                <p className="text-sm text-muted">Sous-total <span className="font-semibold tabular-nums text-ink">{formatFcfa(g.subtotal)}</span></p>
              </div>
              <ul className="divide-y divide-line">
                {g.lines.map((l) => (
                  <li key={l.id} className="flex flex-col gap-4 p-5 sm:flex-row">
                    <Photo src={l.photo} alt="" w={240} h={180} className="aspect-[4/3] w-full shrink-0 rounded-control sm:w-36" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <h3 className="font-semibold text-ink"><Link href={`/produits/${l.slug}`} className="hover:underline">{l.name}</Link></h3>
                        <p className="text-base font-semibold tabular-nums text-ink">{formatFcfa(l.subtotal)}</p>
                      </div>
                      <p className="mt-1 text-sm text-muted">
                        Du {formatDate(l.startDate)} au {formatDate(l.endDate)} ({days(l.startDate, l.endDate)} jour{days(l.startDate, l.endDate) > 1 ? "s" : ""}) · {formatFcfa(l.unitPrice)} par jour
                      </p>
                      <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted"><ShieldCheck size={14} /> Caution {formatFcfa(l.deposit)}</p>
                      {!l.ok && (
                        <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-danger" role="alert">
                          <WarningCircle size={16} /> {l.available <= 0 ? "Plus disponible sur cette période" : `Seulement ${l.available} disponible${l.available > 1 ? "s" : ""} sur cette période`}
                        </p>
                      )}
                      <div className="mt-3">
                        <CartLineControls itemId={l.id} quantity={l.quantity} max={Math.max(l.available, l.quantity)} />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
              {g.cash > 0 && (
                <p className="flex items-start gap-2 border-t border-line bg-warn-soft/40 px-5 py-3 text-sm text-ink">
                  <HandCoins size={18} className="mt-0.5 shrink-0 text-royal-ink" />
                  <span>Ce loueur est payé en espèces : vous payez en ligne un acompte de <strong className="tabular-nums">{formatFcfa(g.subtotal - g.cash)}</strong> et la caution, puis <strong className="tabular-nums">{formatFcfa(g.cash)}</strong> en espèces à la remise du matériel.</span>
                </p>
              )}
            </Card>
          ))}
        </div>

        <aside>
          <Card className="p-5 lg:sticky lg:top-24">
            <h2 className="text-lg font-semibold text-ink">Récapitulatif</h2>
            <dl className="mt-4 space-y-2.5 text-sm">
              {cart.groups.map((g) => (
                <div key={g.lenderId} className="flex justify-between gap-3">
                  <dt className="truncate text-muted">{g.lenderName}</dt>
                  <dd className="tabular-nums text-ink">{formatFcfa(g.subtotal)}</dd>
                </div>
              ))}
              <div className="flex justify-between border-t border-line pt-2.5">
                <dt className="text-muted">Locations</dt>
                <dd className="tabular-nums text-ink">{formatFcfa(cart.subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Cautions{depositPercent != null ? ` (${depositPercent} % de la location)` : ""}</dt>
                <dd className="tabular-nums text-ink">{formatFcfa(cart.deposit)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Livraison</dt>
                <dd className="text-ink">Choisie à l&apos;étape suivante</dd>
              </div>
              {cart.cash > 0 && (
                <div className="flex justify-between">
                  <dt className="text-muted">En espèces aux loueurs</dt>
                  <dd className="tabular-nums text-ink">- {formatFcfa(cart.cash)}</dd>
                </div>
              )}
              <div className="flex justify-between border-t border-line pt-3 text-base font-semibold">
                <dt className="text-ink">{cart.cash > 0 ? "À payer en ligne (estimé)" : "Total estimé"}</dt>
                <dd className="tabular-nums text-ink">{formatFcfa(cart.total)}</dd>
              </div>
            </dl>
            <LinkButton href="/reservation" size="lg" className={`mt-5 w-full ${cart.issues > 0 ? "pointer-events-none opacity-50" : ""}`} aria-disabled={cart.issues > 0}>
              Continuer la réservation
            </LinkButton>
            <p className="mt-3 text-xs leading-relaxed text-muted">Les cautions sont restituées après le constat de retour. Les montants définitifs sont calculés par le serveur.</p>
          </Card>
        </aside>
      </div>
    </div>
  );
}
