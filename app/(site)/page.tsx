import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { can, getActor } from "@/lib/auth/actor";
import { IMAGES, categoryPhoto } from "@/lib/images";
import { DEFAULT_LENDER_DEPOSIT_PERCENT } from "@/services/pricing";
import { featuredProducts, listCategoryTree, listCities, popularProducts, recommendedLenders } from "@/services/catalog";
import { LinkButton } from "@/components/ui/button";
import { Photo } from "@/components/ui/photo";
import { CategoryIcon, ArrowRight, CalendarCheck, MagnifyingGlass, ShieldCheck, Storefront, Receipt, FileText, UploadSimple, Users } from "@/components/ui/icons";
import { Avatar, Stars } from "@/components/ui/misc";
import { ProductCard } from "@/features/catalog/product-card";
import { SearchForm } from "@/features/home/search-form";

export const revalidate = 0;

export const metadata: Metadata = {
  title: "Location de matériel en Côte d’Ivoire",
  description: "Trouvez du matériel à louer pour une journée ou plusieurs jours. Comparez les loueurs, demandez une proforma et choisissez la livraison ou le retrait au dépôt.",
  alternates: { canonical: "/" },
};

const FAQ = [
  { q: "Puis-je louer pour une seule journée ?", a: "Oui, si le matériel est disponible et que le loueur autorise la location à la journée. Pour plusieurs jours, choisissez le premier et le dernier jour de location. Le dernier jour est inclus." },
  { q: "Puis-je commander chez plusieurs loueurs ?", a: "Oui. Ajoutez leurs articles au même panier. Vous choisissez, pour chaque loueur, la livraison ou le retrait au dépôt selon les options proposées." },
  { q: "Quand connaîtrai-je le prix définitif ?", a: "Après validation des loueurs, la proforma réunit la location, les éventuels frais de transport et la caution. Vous pouvez vérifier le total et les créneaux de remise et de retour avant de valider la réservation." },
  { q: "Comment fonctionne la caution ?", a: `Par défaut, la caution est de ${DEFAULT_LENDER_DEPOSIT_PERCENT} % du montant de la location chez chaque loueur, hors transport. Le loueur peut ajuster son montant avant de valider la proforma. Le constat de retour détermine ensuite le montant à restituer.` },
  { q: "Comment ajouter le catalogue de mon entreprise ?", a: "Dans l’espace loueur, ouvrez Mes produits puis Importer un catalogue. Téléchargez le modèle Excel, remplissez-le et vérifiez l’aperçu. L’import crée les fiches et leur stock en brouillon." },
];

export default async function HomePage() {
  const [actor, tree, cities, popular, featured, lenders, counts, reviews] = await Promise.all([
    getActor(),
    listCategoryTree(),
    listCities(),
    popularProducts(14),
    featuredProducts(6),
    recommendedLenders(6),
    Promise.all([
      db.lender.count({ where: { status: "APPROVED" } }),
      db.product.count({ where: { status: "PUBLISHED", deletedAt: null, lender: { status: "APPROVED" } } }),
    ]),
    db.review.findMany({ where: { status: "PUBLISHED", comment: { not: null }, productRating: { gte: 4 } }, include: { client: { select: { firstName: true, lastName: true } }, product: { select: { name: true, slug: true } }, lender: { select: { companyName: true } } }, orderBy: [{ createdAt: "desc" }], take: 3 }),
  ]);
  const signedIn = Boolean(actor);
  const isClient = actor?.accountType === "CLIENT";
  const lenderAction = actor?.accountType === "LENDER"
    ? can(actor, "PRODUCT_VIEW")
      ? { href: "/loueur/produits", label: "Gérer mes produits" }
      : { href: "/loueur/dashboard", label: "Ouvrir mon espace loueur" }
    : { href: "/devenir-loueur", label: "Devenir loueur" };
  const favorites = isClient ? new Set((await db.favorite.findMany({ where: { userId: actor!.userId }, select: { productId: true } })).map((f) => f.productId)) : new Set<string>();
  const [lendersCount, productsCount] = counts;
  const topCategories = tree.filter((category) => category._count.products > 0)
    .sort((a, b) => b._count.products - a._count.products).slice(0, 6);
  const featuredIds = new Set(featured.map((product) => product.id));
  const popularOnly = popular.filter((product) => !featuredIds.has(product.id)).slice(0, 8);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "LOC'CONNECT",
    url: process.env.APP_URL ?? "http://localhost:3000",
    potentialAction: { "@type": "SearchAction", target: `${process.env.APP_URL ?? "http://localhost:3000"}/catalogue?q={search_term_string}`, "query-input": "required name=search_term_string" },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />

      {/* Hero */}
      <section className="relative isolate overflow-hidden bg-navy text-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 pb-14 pt-10 sm:px-6 lg:grid-cols-[1.25fr_1fr] lg:items-center lg:gap-14 lg:pb-20 lg:pt-16">
          <div>
            <h1 className="text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl lg:text-[3.35rem]">
              Louez le matériel dont vous avez besoin
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-white/80">
              Trouvez du matériel près de chez vous, pour une journée ou plusieurs jours. Réunissez les articles de différents loueurs dans un même panier.
            </p>
            <div className="mt-8">
              <SearchForm cities={cities} />
              <Link href="#comment-ca-marche" className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-white/90 hover:underline">
                Comprendre la réservation <ArrowRight size={16} aria-hidden />
              </Link>
            </div>
          </div>
          <div className="relative hidden lg:block" aria-hidden>
            <div className="grid grid-cols-[1.1fr_1fr] gap-4">
              <Photo src={IMAGES.heroMain} alt="" w={640} h={800} priority className="row-span-2 h-[26rem] w-full rounded-card" />
              <Photo src={IMAGES.heroSide} alt="" w={480} h={380} priority className="h-[12.4rem] w-full rounded-card" />
              <Photo src={IMAGES.heroSmall} alt="" w={480} h={380} className="h-[12.4rem] w-full rounded-card" />
            </div>
          </div>
        </div>
      </section>

      {(lendersCount > 0 || productsCount > 0) && (
        <section aria-label="Le catalogue en chiffres" className="mx-auto max-w-7xl px-4 sm:px-6">
          <dl className="flex flex-wrap gap-x-8 gap-y-3 border-b border-line py-5 text-sm text-muted">
            {productsCount > 0 && <div className="flex items-baseline gap-2"><dd className="text-xl font-semibold tabular-nums text-ink">{productsCount}</dd><dt>produits à louer</dt></div>}
            {lendersCount > 0 && <div className="flex items-baseline gap-2"><dd className="text-xl font-semibold tabular-nums text-ink">{lendersCount}</dd><dt>loueurs vérifiés</dt></div>}
          </dl>
        </section>
      )}

      {topCategories.length > 0 && (
        <section className="mx-auto mt-14 max-w-7xl px-4 sm:px-6" aria-labelledby="h-categories">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 id="h-categories" className="text-3xl font-semibold text-ink">Explorer par catégorie</h2>
            <Link href="/categories" className="inline-flex items-center gap-1.5 text-sm font-medium text-royal-ink hover:underline">
              Toutes les catégories <ArrowRight size={16} aria-hidden />
            </Link>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
            {topCategories.map((category) => (
              <Link key={category.id} href={`/categories/${category.slug}`}
                className="group relative isolate flex min-h-36 flex-col justify-end overflow-hidden rounded-card bg-navy focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal sm:min-h-48">
                <Photo src={category.imageUrl ?? categoryPhoto(category.name)} alt="" w={520} h={320} className="absolute inset-0 -z-10 size-full transition duration-500 group-hover:scale-105" />
                <div className="scrim-navy absolute inset-0 -z-10" />
                <div className="p-3 text-white sm:p-5">
                  <CategoryIcon name={category.icon} size={20} />
                  <h3 className="mt-1 break-words text-sm font-semibold sm:text-lg">{category.name}</h3>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* À la une (défilement horizontal) */}
      {featured.length > 0 && (
        <section className="mt-20 bg-surface-2/60 py-14" aria-labelledby="h-featured">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <h2 id="h-featured" className="text-3xl font-semibold text-ink">
              Offres mises en avant
            </h2>
            <div className="-mx-4 mt-8 flex snap-x snap-mandatory scroll-px-4 gap-5 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:scroll-px-6 sm:px-6">
              {featured.map((p) => (
                <div key={p.id} className="w-[17.5rem] shrink-0 snap-start sm:w-80">
                  <ProductCard product={p} signedIn={signedIn} isClient={isClient} favorite={favorites.has(p.id)} />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {popularOnly.length > 0 && <section className="mx-auto mt-20 max-w-7xl px-4 sm:px-6" aria-labelledby="h-popular">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="h-popular" className="text-3xl font-semibold text-ink">
            Produits populaires
          </h2>
          <LinkButton href="/catalogue" variant="secondary">
            Voir le catalogue
          </LinkButton>
        </div>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {popularOnly.map((p) => (
            <ProductCard key={p.id} product={p} signedIn={signedIn} isClient={isClient} favorite={favorites.has(p.id)} />
          ))}
        </div>
      </section>}

      {/* Parcours de réservation */}
      <section id="comment-ca-marche" className="mx-auto mt-24 max-w-7xl scroll-mt-24 px-4 sm:px-6" aria-labelledby="h-how">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.3fr] lg:gap-16">
          <div>
            <h2 id="h-how" className="text-3xl font-semibold text-ink">
              Comment ça marche
            </h2>
            <p className="mt-3 max-w-md text-[17px] text-muted">Suivez votre demande, les validations des loueurs et les documents de remise et de retour depuis votre réservation.</p>
            <LinkButton href="/catalogue" size="lg" className="mt-7">
              Commencer ma recherche
            </LinkButton>
          </div>
          <ol className="relative space-y-7 border-l border-line pl-8">
            {[
              { i: <MagnifyingGlass size={20} />, t: "Choisissez votre matériel et vos dates", d: "Recherchez par ville et par catégorie. Pour une période précise, cochez le filtre de disponibilité dans le catalogue." },
              { i: <CalendarCheck size={20} />, t: "Demandez votre proforma", d: "Indiquez la livraison ou le retrait au dépôt pour chaque loueur. Les loueurs valident les jours, les créneaux, les frais éventuels et la caution." },
              { i: <FileText size={20} />, t: "Vérifiez les montants et réceptionnez le matériel", d: "La proforma détaille le total à régler. À la livraison ou au retrait, relisez les quantités réellement remises et les observations avant de signer le bon du loueur." },
              { i: <Receipt size={20} />, t: "Suivez le retour et la caution", d: "Le constat compare les quantités remises et retournées. En cas d’écart, retrouvez les observations et les actions disponibles dans votre réservation." },
            ].map((s) => (
              <li key={s.t} className="relative">
                <span className="absolute -left-[3.2rem] flex size-10 items-center justify-center rounded-full border border-line bg-surface text-royal-ink">{s.i}</span>
                <h3 className="text-lg font-semibold text-ink">{s.t}</h3>
                <p className="mt-1 max-w-lg text-[15px] leading-relaxed text-muted">{s.d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section aria-labelledby="h-deposit" className="mx-auto mt-14 max-w-7xl px-4 sm:px-6">
        <div className="flex items-start gap-4 rounded-card border border-line bg-surface p-5 sm:items-center sm:p-6">
          <span className="grid size-11 shrink-0 place-items-center rounded-control bg-royal-soft text-royal-ink"><ShieldCheck size={24} aria-hidden /></span>
          <div>
            <h2 id="h-deposit" className="text-lg font-semibold text-ink">La caution est détaillée avant la réservation</h2>
            <p className="mt-1 text-sm text-muted">Par défaut, elle représente {DEFAULT_LENDER_DEPOSIT_PERCENT} % de la location de chaque loueur, hors transport. Chaque loueur peut l’ajuster sur la proforma avant validation.</p>
          </div>
        </div>
      </section>

      {lenders.length > 0 && <section className="mx-auto mt-24 max-w-7xl px-4 sm:px-6" aria-labelledby="h-lenders">
        <h2 id="h-lenders" className="text-3xl font-semibold text-ink">
          Loueurs recommandés
        </h2>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {lenders.map((l) => (
            <li key={l.id}>
              <Link href={`/loueurs/${l.slug}`} className="flex items-center gap-4 rounded-card border border-line bg-surface p-4 shadow-card transition hover:-translate-y-0.5">
                <Avatar name={l.companyName} size={64} className="rounded-control" />
                <div className="min-w-0">
                  <h3 className="truncate text-base font-semibold text-ink">{l.companyName}</h3>
                  <p className="mt-0.5 truncate text-sm text-muted">
                    {l.city.name} · {l._count.products} produit{l._count.products > 1 ? "s" : ""}
                  </p>
                  <div className="mt-1">
                    <Stars value={l.ratingAvg} />
                    {l.reviewCount > 0 && <span className="ml-1 text-xs text-muted">({l.reviewCount} avis)</span>}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>}

      {/* Avis clients */}
      {reviews.length > 0 && (
        <section className="mx-auto mt-24 max-w-7xl px-4 sm:px-6" aria-labelledby="h-reviews">
          <h2 id="h-reviews" className="text-3xl font-semibold text-ink">
            Ils ont loué avec nous
          </h2>
          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            {reviews.slice(0, 1).map((r) => (
              <figure key={r.id} className="flex flex-col justify-between rounded-card bg-navy p-6 text-white">
                <blockquote className="line-clamp-4 text-lg leading-snug">&ldquo;{r.comment}&rdquo;</blockquote>
                <figcaption className="mt-6 text-sm text-white/80">
                  {r.client.firstName} {r.client.lastName.slice(0, 1)}. - {r.product.name}, {r.lender.companyName}
                </figcaption>
              </figure>
            ))}
            {reviews.slice(1).map((r) => (
              <figure key={r.id} className="rounded-card border border-line bg-surface p-6 shadow-card">
                <Stars value={(r.productRating + r.lenderRating + r.experienceRating) / 3} />
                <blockquote className="mt-2 line-clamp-3 text-[15px] leading-relaxed text-ink">&ldquo;{r.comment}&rdquo;</blockquote>
                <figcaption className="mt-3 text-sm text-muted">
                  {r.client.firstName} {r.client.lastName.slice(0, 1)}. - {r.product.name}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      {/* Devenir loueur */}
      <section className="mx-auto mt-24 max-w-7xl px-4 sm:px-6" aria-labelledby="h-lender-cta">
        <div className="relative isolate overflow-hidden rounded-card bg-navy">
          <div className="grid items-center lg:grid-cols-2">
            <div className="p-8 sm:p-12">
              <h2 id="h-lender-cta" className="text-3xl font-semibold text-white sm:text-4xl">
                Mettez votre matériel en location
              </h2>
              <ul className="mt-5 space-y-3 text-sm text-white/85">
                <li className="flex items-start gap-3"><UploadSimple size={20} className="shrink-0" aria-hidden /> Importez jusqu’à 200 articles par fichier Excel, avec leur stock initial.</li>
                <li className="flex items-start gap-3"><Users size={20} className="shrink-0" aria-hidden /> Donnez à votre équipe des accès selon son rôle, du stock aux livraisons.</li>
                <li className="flex items-start gap-3"><Storefront size={20} className="shrink-0" aria-hidden /> Gérez vos proformas, vos bons de remise et vos constats de retour.</li>
              </ul>
              <LinkButton href={lenderAction.href} variant="inverse" size="lg" className="mt-8">
                {lenderAction.label}
              </LinkButton>
            </div>
            <Photo src={IMAGES.trust} alt="" w={900} h={700} className="hidden h-full min-h-72 w-full lg:block" />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto mt-20 max-w-3xl px-4 pb-16 sm:px-6" aria-labelledby="h-faq">
        <h2 id="h-faq" className="text-3xl font-semibold text-ink">
          Questions fréquentes
        </h2>
        <div className="mt-8 divide-y divide-line rounded-card border border-line bg-surface shadow-card">
          {FAQ.map((f) => (
            <details key={f.q} className="group px-5 py-4">
              <summary className="flex cursor-pointer items-center justify-between gap-4 text-[16px] font-medium text-ink">
                {f.q}
                <span className="text-xl text-royal-ink transition group-open:rotate-45" aria-hidden>
                  +
                </span>
              </summary>
              <p className="mt-3 text-[15px] leading-relaxed text-muted">{f.a}</p>
            </details>
          ))}
        </div>
        <p className="mt-5 text-center text-sm text-muted">
          Une autre question ? <Link href="/faq" className="font-medium text-royal-ink hover:underline">Consultez la FAQ complète</Link> ou <Link href="/contact" className="font-medium text-royal-ink hover:underline">contactez-nous</Link>.
        </p>
      </section>
    </>
  );
}
