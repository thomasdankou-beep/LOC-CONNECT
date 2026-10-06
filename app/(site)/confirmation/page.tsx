import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getActor } from "@/lib/auth/actor";
import { formatDate } from "@/lib/dates";
import { formatFcfa } from "@/lib/money";
import { getReservationDetail } from "@/services/reservations";
import { RESERVATION_STATUS } from "@/lib/labels";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Notice } from "@/components/ui/states";
import { CheckCircle, ClipboardText, HandCoins, Truck, Storefront } from "@/components/ui/icons";
import { CheckoutSteps } from "@/features/checkout/steps";

export const metadata: Metadata = { title: "Réservation confirmée", robots: { index: false } };

export default async function ConfirmationPage({ searchParams }: { searchParams: Promise<{ reservation?: string }> }) {
  const { reservation: id } = await searchParams;
  const actor = await getActor();
  if (!actor) redirect("/connexion");
  if (!id) redirect("/mes-reservations");
  const { reservation: r } = await getReservationDetail(actor, id).catch(() => redirect("/mes-reservations"));
  const cash = r.cashSettlements.filter((c) => c.status === "PENDING" && c.amountDue > 0);
  const paid = r.payments.find((p) => p.kind === "INITIAL" && p.status !== "PENDING" && p.status !== "FAILED" && p.status !== "CANCELLED");

  return (
    <div className="mx-auto max-w-3xl px-4 pb-4 pt-8 sm:px-6">
      <CheckoutSteps current={3} />
      <div className="mt-8 text-center">
        <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-success-soft text-success"><CheckCircle size={36} weight="fill" /></span>
        <h1 className="mt-5 text-3xl font-semibold text-ink sm:text-4xl">{paid ? "Réservation confirmée" : "Réservation enregistrée"}</h1>
        <p className="mt-2 text-muted">Référence <span className="font-mono font-medium text-ink">{r.reference}</span>. {paid ? "Les loueurs ont été notifiés." : "Le paiement n'est pas encore confirmé."}</p>
      </div>

      {paid?.provider === "simulated" && (
        <div className="mt-6"><Notice tone="warning" title="Paiement de démonstration">Ce paiement est simulé : aucun argent réel n&apos;a été prélevé.</Notice></div>
      )}

      <Card className="mt-8 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-ink">Résumé</h2>
          <StatusBadge entry={RESERVATION_STATUS[r.status]} />
        </div>
        <ul className="mt-4 divide-y divide-line">
          {r.items.map((i) => (
            <li key={i.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
              <div>
                <p className="font-medium text-ink">{i.quantity} x {i.productName}</p>
                <p className="text-sm text-muted">{i.lender.companyName} · du {formatDate(i.startDate)} au {formatDate(i.endDate)}</p>
                <p className="text-sm text-muted">Caution : {formatFcfa(i.depositAmount)}</p>
              </div>
              <p className="font-medium tabular-nums text-ink">{formatFcfa(i.subtotal)}</p>
            </li>
          ))}
        </ul>
        <dl className="mt-3 space-y-1.5 border-t border-line pt-4 text-sm">
          <div className="flex justify-between"><dt className="text-muted">Locations</dt><dd className="tabular-nums">{formatFcfa(r.subtotal)}</dd></div>
          {r.deliveryFee > 0 && <div className="flex justify-between"><dt className="text-muted">Livraison</dt><dd className="tabular-nums">{formatFcfa(r.deliveryFee)}</dd></div>}
          <div className="flex justify-between"><dt className="text-muted">Cautions</dt><dd className="tabular-nums">{formatFcfa(r.depositTotal)}</dd></div>
          <div className="flex justify-between text-base font-semibold"><dt>{r.cashTotal > 0 ? "Payé en ligne" : "Total payé"}</dt><dd className="tabular-nums">{formatFcfa(r.total)}</dd></div>
          {r.cashTotal > 0 && <div className="flex justify-between text-base font-semibold"><dt>Reste à payer en espèces</dt><dd className="tabular-nums">{formatFcfa(r.cashTotal)}</dd></div>}
        </dl>
      </Card>

      {cash.length > 0 && (
        <Card className="mt-6 p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-ink"><HandCoins size={22} className="text-royal-ink" /> À payer en espèces à la remise</h2>
          <ul className="mt-4 space-y-3">
            {cash.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-line px-4 py-3">
                <div>
                  <p className="font-medium text-ink">{c.lender.companyName} : {formatFcfa(c.amountDue)}</p>
                  {paid && typeof c.code === "string" && <p className="text-sm text-muted">Code de remise <span className="font-mono text-base font-semibold tracking-[0.25em] text-ink">{c.code}</span></p>}
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-muted">Payez ce montant au loueur quand il vous remet le matériel, puis donnez-lui votre code de remise : c&apos;est votre preuve de paiement. Ne le donnez jamais avant d&apos;avoir payé et reçu le matériel. Vous le retrouvez dans le détail de votre réservation.</p>
        </Card>
      )}

      <Card className="mt-6 p-6">
        <h2 className="text-lg font-semibold text-ink">Prochaines étapes</h2>
        <ol className="mt-4 space-y-4 text-[15px]">
          <li className="flex gap-3"><ClipboardText size={22} className="mt-0.5 shrink-0 text-royal-ink" /><span><span className="font-medium text-ink">Les loueurs préparent votre commande.</span> <span className="text-muted">Vous êtes notifié à chaque changement de statut.</span></span></li>
          <li className="flex gap-3">{r.fulfillmentType === "DELIVERY" ? <Truck size={22} className="mt-0.5 shrink-0 text-royal-ink" /> : <Storefront size={22} className="mt-0.5 shrink-0 text-royal-ink" />}<span><span className="font-medium text-ink">{r.fulfillmentType === "DELIVERY" ? "Livraison à l'adresse indiquée." : "Retrait chez chaque loueur."}</span> <span className="text-muted">Présentez la référence {r.reference}.</span></span></li>
          <li className="flex gap-3"><CheckCircle size={22} className="mt-0.5 shrink-0 text-royal-ink" /><span><span className="font-medium text-ink">Au retour, un constat est établi.</span> <span className="text-muted">Votre caution est libérée ou ajustée selon l&apos;état du matériel.</span></span></li>
        </ol>
      </Card>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <LinkButton href={`/mes-reservations/${r.id}`} size="lg">Suivre ma réservation</LinkButton>
        <LinkButton href="/catalogue" size="lg" variant="secondary">Continuer mes recherches</LinkButton>
      </div>
      <p className="mt-6 text-center text-sm text-muted">Un doute ? <Link href="/contact" className="font-medium text-royal-ink hover:underline">Contactez le support</Link>.</p>
    </div>
  );
}
