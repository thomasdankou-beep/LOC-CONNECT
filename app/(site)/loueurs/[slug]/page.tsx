import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getActor } from "@/lib/auth/actor";
import { formatDate } from "@/lib/dates";
import { Photo } from "@/components/ui/photo";
import { Avatar, Stars } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { HandCoins, MapPin, ShieldCheck, Truck } from "@/components/ui/icons";
import { getSettings } from "@/lib/settings";
import { effectivePaymentMode } from "@/services/pricing";
import { Pagination } from "@/components/ui/pagination";
import { ProductCard } from "@/features/catalog/product-card";
import { searchProducts } from "@/services/catalog";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ page?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const l = await db.lender.findFirst({ where: { slug, status: "APPROVED" }, include: { city: true } });
  if (!l) return { title: "Loueur introuvable" };
  return { title: `${l.companyName}, loueur à ${l.city.name}`, description: l.description?.slice(0, 160) ?? `Matériel à louer chez ${l.companyName}.`, alternates: { canonical: `/loueurs/${l.slug}` } };
}

export default async function LenderPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const lender = await db.lender.findFirst({ where: { slug, status: "APPROVED" }, include: { city: true } });
  if (!lender) notFound();
  const page = Math.max(1, Number(sp.page) || 1);
  const [actor, result, reviews] = await Promise.all([
    getActor(),
    searchProducts({ lenderId: lender.id, page, pageSize: 12, sort: "relevance" }),
    db.review.findMany({ where: { lenderId: lender.id, status: "PUBLISHED" }, include: { client: { select: { firstName: true, lastName: true } }, product: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 6 }),
  ]);
  const isClient = actor?.accountType === "CLIENT";
  const paymentMode = effectivePaymentMode(lender, await getSettings());

  return (
    <div>
      <div className="relative h-48 w-full overflow-hidden bg-navy sm:h-64">
        {lender.coverUrl && <Photo src={lender.coverUrl} alt="" w={1600} h={600} priority className="size-full opacity-70" />}
        <div className="scrim-navy absolute inset-0" />
      </div>
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="-mt-12 flex flex-wrap items-end gap-5">
          <Avatar name={lender.companyName} size={96} className="rounded-card border-4 border-canvas" />
          <div className="pb-1">
            <h1 className="text-3xl font-semibold text-ink">{lender.companyName}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
              <span className="flex items-center gap-1"><MapPin size={14} /> {lender.city.name}</span>
              <Stars value={lender.ratingAvg} />
              {lender.reviewCount > 0 && <span>{lender.reviewCount} avis</span>}
              <Badge tone="success"><ShieldCheck size={14} className="mr-1" /> Loueur vérifié</Badge>
              {lender.offersDelivery && <Badge><Truck size={14} className="mr-1" /> Livraison disponible</Badge>}
              {paymentMode === "DEPOSIT_CASH" ? <Badge tone="warning"><HandCoins size={14} className="mr-1" /> Acompte en ligne + solde en espèces</Badge> : <Badge tone="success"><ShieldCheck size={14} className="mr-1" /> Paiement 100 % protégé</Badge>}
            </p>
          </div>
        </div>
        {lender.description && <p className="mt-5 max-w-3xl text-[16px] leading-relaxed text-ink/90">{lender.description}</p>}

        <section className="mt-10" aria-labelledby="h-products">
          <h2 id="h-products" className="text-2xl font-semibold text-ink">Produits ({result.total})</h2>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {result.items.map((p) => (
              <ProductCard key={p.id} product={p} signedIn={Boolean(actor)} isClient={isClient} />
            ))}
          </div>
          <Pagination page={result.page} totalPages={result.totalPages} basePath={`/loueurs/${lender.slug}`} />
        </section>

        {reviews.length > 0 && (
          <section className="mt-14" aria-labelledby="h-lender-reviews">
            <h2 id="h-lender-reviews" className="text-2xl font-semibold text-ink">Avis des clients</h2>
            <ul className="mt-6 grid gap-4 md:grid-cols-2">
              {reviews.map((r) => (
                <li key={r.id} className="rounded-card border border-line bg-surface p-5">
                  <div className="flex items-center justify-between"><p className="font-medium text-ink">{r.client.firstName} {r.client.lastName.slice(0, 1)}.</p><Stars value={r.lenderRating} /></div>
                  {r.comment && <p className="mt-2 text-[15px] text-ink/90">{r.comment}</p>}
                  <p className="mt-2 text-xs text-muted">{r.product.name}, {formatDate(r.createdAt)}</p>
                  {r.lenderReply && <p className="mt-3 rounded-control bg-surface-2 p-3 text-sm"><span className="font-medium text-ink">Réponse du loueur : </span>{r.lenderReply}</p>}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
