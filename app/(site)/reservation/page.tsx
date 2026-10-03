import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getActor } from "@/lib/auth/actor";
import { formatFcfa } from "@/lib/money";
import { getSettings } from "@/lib/settings";
import { getCart } from "@/services/cart";
import { listCities } from "@/services/catalog";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/states";
import { FulfillmentForm } from "@/features/checkout/fulfillment-form";
import { CheckoutSteps } from "@/features/checkout/steps";
import { ShieldCheck } from "@/components/ui/icons";

export const metadata: Metadata = { title: "Récapitulatif de la réservation", robots: { index: false } };

export default async function ReservationPage() {
  const actor = await getActor();
  if (!actor) redirect("/connexion?next=/reservation");
  if (actor.accountType !== "CLIENT") redirect("/");
  const [cart, cities, user, policy, settings] = await Promise.all([
    getCart(actor.userId),
    listCities(),
    db.user.findUniqueOrThrow({ where: { id: actor.userId } }),
    db.cancellationPolicy.findFirst({ where: { active: true }, orderBy: [{ isDefault: "desc" }], include: { rules: { orderBy: { minHoursBefore: "desc" } } } }),
    getSettings(),
  ]);
  if (cart.lines.length === 0) redirect("/panier");
  if (cart.issues > 0) redirect("/panier");

  const lenderIds = cart.groups.map((g) => g.lenderId);
  const lenders = await db.lender.findMany({ where: { id: { in: lenderIds } }, select: { id: true, companyName: true, cityId: true, offersDelivery: true, deliveryFeeLocal: true, deliveryFeeRemote: true } });

  return (
    <div className="mx-auto max-w-7xl px-4 pb-4 pt-8 sm:px-6">
      <CheckoutSteps current={1} />
      <h1 className="mt-6 text-3xl font-semibold text-ink sm:text-4xl">Récapitulatif de la réservation</h1>
      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_24rem]">
        <Card className="p-6 sm:p-8">
          <FulfillmentForm
            lenders={lenders.map((l) => ({ lenderId: l.id, name: l.companyName, cityId: l.cityId, offersDelivery: l.offersDelivery, feeLocal: l.deliveryFeeLocal, feeRemote: l.deliveryFeeRemote }))}
            cities={cities.map((c) => ({ id: c.id, name: c.name }))}
            defaults={{ address: user.deliveryAddress ?? "", cityId: user.cityId ?? "", phone: user.phone ?? "" }}
          />
        </Card>
        <aside className="space-y-5">
          <Card className="p-5">
            <h2 className="text-lg font-semibold text-ink">Votre commande</h2>
            <ul className="mt-4 space-y-4">
              {cart.groups.map((g) => (
                <li key={g.lenderId}>
                  <p className="text-sm font-semibold text-ink">{g.lenderName}</p>
                  <ul className="mt-1.5 space-y-1 text-sm text-muted">
                    {g.lines.map((l) => (
                      <li key={l.id} className="flex justify-between gap-3">
                        <span className="truncate">{l.quantity} x {l.name}</span>
                        <span className="tabular-nums text-ink">{formatFcfa(l.subtotal)}</span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
            <dl className="mt-4 space-y-2 border-t border-line pt-4 text-sm">
              <div className="flex justify-between"><dt className="text-muted">Locations</dt><dd className="tabular-nums">{formatFcfa(cart.subtotal)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Cautions</dt><dd className="tabular-nums">{formatFcfa(cart.deposit)}</dd></div>
              <div className="flex justify-between text-base font-semibold"><dt>Total avant livraison</dt><dd className="tabular-nums">{formatFcfa(cart.total)}</dd></div>
            </dl>
            <Link href="/panier" className="mt-3 inline-block text-sm font-medium text-royal-ink hover:underline">Modifier le panier</Link>
          </Card>
          <Card className="p-5">
            <h2 className="flex items-center gap-2 text-base font-semibold text-ink"><ShieldCheck size={18} className="text-royal-ink" /> Conditions d&apos;annulation</h2>
            {policy ? (
              <ul className="mt-3 space-y-1.5 text-sm text-ink/90">
                {policy.rules.map((r) => (
                  <li key={r.id}>
                    {r.refundPercent}&nbsp;% remboursés {r.minHoursBefore > 0 ? `si vous annulez au moins ${r.minHoursBefore >= 48 ? `${Math.round(r.minHoursBefore / 24)} jours` : `${r.minHoursBefore} h`} avant le début` : "ensuite"}
                  </li>
                ))}
              </ul>
            ) : null}
            <p className="mt-3 text-sm text-muted">La caution est toujours restituée en intégralité en cas d&apos;annulation. Modification possible jusqu&apos;à {settings["modification.free_deadline_hours"]} h avant le début, avec accord du loueur.</p>
          </Card>
          <Notice tone="info">Les montants affichés sont indicatifs. Prix, commissions et frais sont recalculés par le serveur à la création de la réservation.</Notice>
        </aside>
      </div>
    </div>
  );
}
