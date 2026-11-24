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
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { ArrowLeft, Bell, CalendarBlank, FileText, Storefront } from "@/components/ui/icons";
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
  const isClient = actor.accountType === "CLIENT";
  const backHref = isClient ? "/mes-factures" : "/admin/reservations";
  const pendingIds = new Set(data.deliveryApproval?.pendingLenderIds);
  const expired = status === "EXPIRED";

  if (status === "AWAITING_DELIVERY" || (expired && pendingIds.size > 0)) {
    const confirmed = data.groups.filter((group) => !pendingIds.has(group.lenderId)).length;
    return (
      <div className="mx-auto max-w-3xl px-4 py-4 sm:px-6 sm:py-10">
        <Link href={backHref} className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-royal-ink hover:underline">
          <ArrowLeft size={16} aria-hidden /> {isClient ? "Mes factures et proformas" : "Réservations"}
        </Link>
        <section aria-labelledby="quote-heading" className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
          <header className="border-b border-line px-5 py-6 sm:px-8 sm:py-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-control bg-royal-soft text-royal-ink"><FileText size={22} aria-hidden /></span>
                <p className="text-sm font-medium text-muted">Proforma <span className="font-mono text-ink">{quote.number}</span></p>
              </div>
              <Badge tone={expired ? "danger" : "warning"}>{expired ? "Expirée" : "En attente"}</Badge>
            </div>
            <h1 id="quote-heading" className="mt-4 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
              {expired ? "Cette demande a expiré" : "En attente de validation des loueurs"}
            </h1>
            <p className="mt-2 flex items-center gap-2 text-sm text-muted">
              <CalendarBlank size={17} aria-hidden /> {expired ? "Expirée le" : "Valable jusqu’au"} {formatDate(quote.validUntil)}
            </p>
          </header>
          <div className="px-5 py-6 sm:px-8">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold text-ink">Réponses des loueurs</h2>
              <p className="text-sm text-muted">{confirmed} sur {data.groups.length} validées</p>
            </div>
            <ul className="mt-3 divide-y divide-line rounded-control border border-line">
              {data.groups.map((group) => {
                const pending = pendingIds.has(group.lenderId);
                return (
                  <li key={group.lenderId} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <Storefront size={20} className="shrink-0 text-muted" aria-hidden />
                      <div className="min-w-0">
                        <p className="break-words text-sm font-medium text-ink">{group.seller.name}</p>
                        <p className="text-xs text-muted">{(group.fulfillment ?? data.fulfillment) === "PICKUP" ? "Retrait au dépôt" : "Livraison"}</p>
                      </div>
                    </div>
                    <Badge tone={pending ? (expired ? "neutral" : "warning") : "success"}>
                      {pending ? (expired ? "Sans réponse" : "En attente") : "Validée"}
                    </Badge>
                  </li>
                );
              })}
            </ul>
            {expired ? (
              isClient && <LinkButton href="/panier" className="mt-5 w-full sm:w-auto">Retourner au panier</LinkButton>
            ) : (
              <div className="mt-5 flex items-start gap-3 rounded-control bg-royal-soft p-4 text-sm text-royal-ink">
                <Bell size={20} className="shrink-0" aria-hidden />
                <p>{isClient ? "Vous recevrez une notification dès que tous les loueurs auront validé. Vous pourrez alors vérifier la proforma et passer au paiement." : "Le client recevra une notification dès que tous les loueurs auront validé la proforma."}</p>
              </div>
            )}
          </div>
        </section>
      </div>
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
      backHref={backHref}
      banner={banner}
      action={actor.accountType === "CLIENT" && status === "OPEN" ? <PayQuoteButton quoteId={quote.id} label={`Payer ${formatFcfa(quote.total)}`} hasTerms={data.groups.some((g) => g.terms)} /> : undefined}
    />
  );
}
