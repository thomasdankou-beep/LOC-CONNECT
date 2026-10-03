import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getActor } from "@/lib/auth/actor";
import { formatDate } from "@/lib/dates";
import { formatFcfa } from "@/lib/money";
import { getProductBySlug, getProductReviews, similarProducts } from "@/services/catalog";
import { AppError } from "@/lib/errors";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Avatar, Stars } from "@/components/ui/misc";
import { CaretRight, MapPin, ShieldCheck, Storefront, Truck, Info } from "@/components/ui/icons";
import { BookingPanel } from "@/features/catalog/booking-panel";
import { Gallery } from "@/features/catalog/gallery";
import { ProductCard } from "@/features/catalog/product-card";
import { FavoriteButton } from "@/features/catalog/favorite-button";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ start?: string; end?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const p = await db.product.findFirst({ where: { slug, status: "PUBLISHED", deletedAt: null }, include: { city: true, category: true, photos: { orderBy: { position: "asc" }, take: 1 } } });
  if (!p) return { title: "Produit introuvable" };
  return {
    title: `Location ${p.name} à ${p.city.name}`,
    description: `${p.name} en location à ${p.city.name} dès ${formatFcfa(p.unitPrice)} par jour. Caution ${formatFcfa(p.depositAmount)}. ${p.description.slice(0, 110)}`,
    alternates: { canonical: `/produits/${p.slug}` },
    openGraph: { title: `Location ${p.name} à ${p.city.name} | LOC'CONNECT`, images: p.photos[0] ? [p.photos[0].url] : undefined },
  };
}

export default async function ProductPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const product = await getProductBySlug(slug).catch((e) => {
    if (e instanceof AppError && e.code === "NOT_FOUND") return null;
    throw e;
  });
  if (!product) notFound();

  const [actor, reviews, similar] = await Promise.all([getActor(), getProductReviews(product.id), similarProducts(product.id, product.categoryId)]);
  const isClient = actor?.accountType === "CLIENT";
  const isFavorite = isClient ? Boolean(await db.favorite.findUnique({ where: { userId_productId: { userId: actor!.userId, productId: product.id } } })) : false;
  const initialStart = sp.start && /^\d{4}-\d{2}-\d{2}$/.test(sp.start) ? sp.start : undefined;
  const initialEnd = sp.end && /^\d{4}-\d{2}-\d{2}$/.test(sp.end) ? sp.end : undefined;
  const lender = product.lender;
  const base = process.env.APP_URL ?? "http://localhost:3000";

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    image: product.photos.map((p) => p.url),
    brand: { "@type": "Brand", name: lender.companyName },
    offers: { "@type": "Offer", priceCurrency: "XOF", price: product.unitPrice, availability: product.stockQuantity > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock", url: `${base}/produits/${product.slug}` },
    ...(product.reviewCount > 0 ? { aggregateRating: { "@type": "AggregateRating", ratingValue: product.ratingAvg, reviewCount: product.reviewCount } } : {}),
  };

  return (
    <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <nav aria-label="Fil d'Ariane" className="mb-5 flex flex-wrap items-center gap-1.5 text-sm text-muted">
        <Link href="/catalogue" className="hover:text-ink">Catalogue</Link>
        <CaretRight size={12} />
        {product.category.parent && (
          <>
            <Link href={`/categories/${product.category.parent.slug}`} className="hover:text-ink">{product.category.parent.name}</Link>
            <CaretRight size={12} />
          </>
        )}
        <Link href={`/categories/${product.category.slug}`} className="hover:text-ink">{product.category.name}</Link>
      </nav>

      <div className="grid gap-8 lg:grid-cols-[1fr_24rem] xl:grid-cols-[1fr_26rem]">
        <div className="min-w-0 space-y-8">
          <Gallery photos={product.photos.map((p) => ({ url: p.url, alt: p.alt }))} name={product.name} />

          <header>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="info">{product.category.name}</Badge>
              <Badge>{product.city.name}</Badge>
            </div>
            <div className="mt-3 flex items-start justify-between gap-4">
              <h1 className="text-3xl font-semibold text-ink sm:text-4xl">{product.name}</h1>
              <FavoriteButton productId={product.id} initial={isFavorite} signedIn={Boolean(actor) && isClient} className="border border-line" />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
              <Stars value={product.ratingAvg} />
              {product.reviewCount > 0 && <span>{product.reviewCount} avis</span>}
              <span className="flex items-center gap-1"><MapPin size={14} /> {product.city.name}</span>
            </div>
          </header>

          <section aria-labelledby="h-desc">
            <h2 id="h-desc" className="text-xl font-semibold text-ink">Description</h2>
            <p className="mt-2 max-w-2xl whitespace-pre-line text-[16px] leading-relaxed text-ink/90">{product.description}</p>
            <dl className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-card border border-line bg-surface p-4">
                <dt className="text-xs font-medium uppercase tracking-wide text-muted">Prix</dt>
                <dd className="mt-1 text-lg font-semibold tabular-nums text-ink">{formatFcfa(product.unitPrice)} <span className="text-sm font-normal text-muted">/ jour</span></dd>
              </div>
              <div className="rounded-card border border-line bg-surface p-4">
                <dt className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted"><ShieldCheck size={14} /> Caution</dt>
                <dd className="mt-1 text-lg font-semibold tabular-nums text-ink">{formatFcfa(product.depositAmount)} <span className="text-sm font-normal text-muted">par unité</span></dd>
              </div>
              <div className="rounded-card border border-line bg-surface p-4">
                <dt className="text-xs font-medium uppercase tracking-wide text-muted">Quantité en stock</dt>
                <dd className="mt-1 text-lg font-semibold tabular-nums text-ink">{product.stockQuantity}</dd>
              </div>
            </dl>
          </section>

          <section aria-labelledby="h-conditions">
            <h2 id="h-conditions" className="text-xl font-semibold text-ink">Conditions de location</h2>
            <ul className="mt-3 space-y-2.5 text-[15px] text-ink/90">
              <li className="flex gap-2.5"><Info size={18} className="mt-0.5 shrink-0 text-royal-ink" /> Durée : de {product.minDays} jour{product.minDays > 1 ? "s" : ""}{product.maxDays ? ` à ${product.maxDays} jours` : ""}. Le jour de retour n&apos;est pas facturé.</li>
              <li className="flex gap-2.5"><ShieldCheck size={18} className="mt-0.5 shrink-0 text-royal-ink" /> {product.allowsExtraBilling ? "En cas de dommage supérieur à la caution, le complément peut être facturé." : "En cas de dommage, la retenue est plafonnée au montant de la caution."}</li>
              <li className="flex gap-2.5"><Truck size={18} className="mt-0.5 shrink-0 text-royal-ink" /> {lender.offersDelivery ? `Retrait chez le loueur ou livraison (${formatFcfa(lender.deliveryFeeLocal)} dans sa ville, ${formatFcfa(lender.deliveryFeeRemote)} ailleurs).` : "Retrait chez le loueur uniquement."}</li>
              {product.conditions && <li className="flex gap-2.5"><Info size={18} className="mt-0.5 shrink-0 text-royal-ink" /> {product.conditions}</li>}
            </ul>
          </section>

          <Card className="p-5">
            <div className="flex items-start gap-4">
              <Avatar name={lender.companyName} size={56} className="rounded-control" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium uppercase tracking-wide text-muted">Proposé par</p>
                <h2 className="text-lg font-semibold text-ink">{lender.companyName}</h2>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-sm text-muted">
                  <span className="flex items-center gap-1"><MapPin size={14} /> {lender.city.name}</span>
                  <Stars value={lender.ratingAvg} />
                  {lender.reviewCount > 0 && <span>{lender.reviewCount} avis</span>}
                </p>
                {lender.description && <p className="mt-2 line-clamp-2 text-sm text-ink/80">{lender.description}</p>}
              </div>
              <Link href={`/loueurs/${lender.slug}`} className="hidden shrink-0 items-center gap-1.5 text-sm font-medium text-royal-ink hover:underline sm:inline-flex"><Storefront size={16} /> Voir le profil</Link>
            </div>
          </Card>

          <section aria-labelledby="h-reviews">
            <h2 id="h-reviews" className="text-xl font-semibold text-ink">Avis ({product.reviewCount})</h2>
            {reviews.length === 0 ? (
              <p className="mt-2 text-muted">Pas encore d&apos;avis sur ce produit. Les avis sont publiés après une location terminée.</p>
            ) : (
              <ul className="mt-4 space-y-4">
                {reviews.map((r) => (
                  <li key={r.id} className="rounded-card border border-line bg-surface p-5">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium text-ink">{r.client.firstName} {r.client.lastName.slice(0, 1)}.</p>
                      <Stars value={r.productRating} />
                    </div>
                    {r.comment && <p className="mt-2 text-[15px] text-ink/90">{r.comment}</p>}
                    <p className="mt-2 text-xs text-muted">{formatDate(r.createdAt)}</p>
                    {r.lenderReply && (
                      <div className="mt-3 rounded-control bg-surface-2 p-3 text-sm">
                        <p className="font-medium text-ink">Réponse du loueur</p>
                        <p className="mt-0.5 text-ink/90">{r.lenderReply}</p>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div>
          <BookingPanel
            productId={product.id}
            unitPrice={product.unitPrice}
            deposit={product.depositAmount}
            stock={product.stockQuantity}
            minDays={product.minDays}
            maxDays={product.maxDays}
            signedIn={Boolean(actor)}
            canBook={!actor || isClient}
            initialStart={initialStart}
            initialEnd={initialEnd}
          />
        </div>
      </div>

      {similar.length > 0 && (
        <section className="mt-16" aria-labelledby="h-similar">
          <h2 id="h-similar" className="text-2xl font-semibold text-ink">Produits similaires</h2>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {similar.map((p) => (
              <ProductCard key={p.id} product={p} signedIn={Boolean(actor)} isClient={isClient} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
