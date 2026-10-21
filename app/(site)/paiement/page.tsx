import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getActor } from "@/lib/auth/actor";
import { getHold } from "@/services/holds";
import { AppError } from "@/lib/errors";
import { CheckoutSteps } from "@/features/checkout/steps";
import { PaymentPanel } from "@/features/checkout/payment-panel";

export const metadata: Metadata = { title: "Paiement", robots: { index: false } };

export default async function PaymentPage({ searchParams }: { searchParams: Promise<{ hold?: string }> }) {
  const { hold: holdId } = await searchParams;
  const actor = await getActor();
  if (!actor) redirect("/connexion?next=/panier");
  if (actor.accountType !== "CLIENT") redirect("/");
  if (!holdId) redirect("/panier");
  const hold = await getHold(actor.userId, holdId).catch((e) => {
    if (e instanceof AppError) return null;
    throw e;
  });
  if (!hold || hold.status !== "ACTIVE" || hold.secondsLeft <= 0) redirect("/panier");

  return (
    <div className="mx-auto max-w-7xl px-4 pb-4 pt-8 sm:px-6">
      <CheckoutSteps current={2} />
      <h1 className="mt-6 text-3xl font-semibold text-ink sm:text-4xl">Paiement</h1>
      <div className="mt-8">
        <PaymentPanel holdId={hold.id} secondsLeft={hold.secondsLeft} />
      </div>
    </div>
  );
}
