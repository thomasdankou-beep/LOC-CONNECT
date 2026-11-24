import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { pageActor } from "@/lib/auth/page";
import { AppError } from "@/lib/errors";
import { formatDate } from "@/lib/dates";
import { formatFcfa } from "@/lib/money";
import { getQuoteForActor } from "@/services/quotes";
import { QuoteDocument } from "@/features/invoices/quote-document";
import { PayQuoteButton } from "@/features/invoices/pay-quote-button";
import { reservationHref } from "@/features/invoices/helpers";

export const metadata: Metadata = { title: "Proforma", robots: { index: false } };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await pageActor(`/proformas/${id}`);
  const r = await getQuoteForActor(actor, id).catch((e) => {
    if (e instanceof AppError && (e.code === "NOT_FOUND" || e.code === "FORBIDDEN")) return null;
    throw e;
  });
  if (!r) notFound();
  const { quote, data, status } = r;
  if (status === "AWAITING_DELIVERY" || (status === "EXPIRED" && data.deliveryApproval?.pendingLenderIds.length)) {
    const pendingLenders = data.groups.filter((group) => data.deliveryApproval?.pendingLenderIds.includes(group.lenderId));
    return (
      <main className="mx-auto max-w-2xl space-y-4 p-6">
        <h1 className="text-2xl font-bold">Demande {quote.number}</h1>
        {status === "EXPIRED" ? (
          <p>Cette demande a expiré. Vous pouvez demander un nouveau tarif depuis votre panier.</p>
        ) : (
          <>
            <p>Validation de la proforma attendue de {pendingLenders.map((group) => group.seller.name).join(", ")}.</p>
            <p>Le client recevra une notification dès que la proforma sera prête à être validée.</p>
          </>
        )}
        <Link className="underline" href={actor.accountType === "CLIENT" ? "/mes-factures" : "/admin/reservations"}>Retour</Link>
      </main>
    );
  }
  const paid = quote.reservations.find((x) => !["DRAFT", "HOLD", "PENDING_PAYMENT", "CANCELLED"].includes(x.status));

  const banner =
    status === "PAID" && paid ? (
      <>Proforma payée : commande <Link href={reservationHref(actor, paid.id)} className="font-mono underline">{paid.reference}</Link>. Les factures sont disponibles depuis la commande.</>
    ) : status === "EXPIRED" ? (
      `Proforma expirée le ${formatDate(quote.validUntil)}. Demandez-en une nouvelle depuis votre panier.`
    ) : undefined;

  return (
    <QuoteDocument
      number={quote.number}
      createdAt={quote.createdAt}
      validUntil={quote.validUntil}
      acceptedAt={quote.acceptedAt}
      data={data}
      backHref={actor.accountType === "CLIENT" ? "/mes-factures" : "/admin/reservations"}
      banner={banner}
      action={actor.accountType === "CLIENT" && status === "OPEN" ? <PayQuoteButton quoteId={quote.id} label={`Payer ${formatFcfa(quote.total)}`} hasTerms={data.groups.some((g) => g.terms)} /> : undefined}
    />
  );
}
