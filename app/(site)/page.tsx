import Link from "next/link";
import { db } from "@/lib/db";
import { getActor } from "@/lib/auth/actor";
import { IMAGES, categoryPhoto } from "@/lib/images";
import { featuredProducts, listCategoryTree, listCities, popularProducts, recommendedLenders } from "@/services/catalog";
import { LinkButton } from "@/components/ui/button";
import { Photo } from "@/components/ui/photo";
import { CategoryIcon, ArrowRight, CalendarCheck, Handshake, MagnifyingGlass, ShieldCheck, Storefront, Receipt, Scales, MapPin, Wallet } from "@/components/ui/icons";
import { Avatar, Stars } from "@/components/ui/misc";
import { Reveal } from "@/components/ui/reveal";
import { ProductCard } from "@/features/catalog/product-card";
import { SearchForm } from "@/features/home/search-form";

export const revalidate = 0;

const FAQ = [
  { q: "Comment fonctionne la caution ?", a: "Chaque article a sa propre caution, payée avec la réservation. Après le retour, le loueur fait un constat. Sans dommage, la caution vous est restituée en totalité. En cas de dommage, seule la somme justifiée est retenue." },
  { q: "Puis-je louer chez plusieurs loueurs en une seule commande ?", a: "Oui. Votre panier peut contenir du matériel de plusieurs loueurs. Vous payez une seule fois, et nous répartissons le règlement entre les loueurs concernés." },
  { q: "Que se passe-t-il si je dois annuler ?", a: "Le remboursement dépend du délai avant le début de la location, selon la politique d'annulation affichée avant la confirmation. Votre caution est toujours restituée en intégralité." },
  { q: "Puis-je modifier ma réservation après paiement ?", a: "Oui, jusqu'à 24 heures avant le début. Le loueur valide la demande, vous réglez seulement le complément éventuel, ou la différence vous est remboursée." },
  { q: "Les loueurs sont-ils vérifiés ?", a: "Chaque entreprise est validée par notre équipe avant de pouvoir publier ses produits. Les avis publiés proviennent uniquement de clients ayant terminé une location." },
  { q: "Comment devenir loueur ?", a: "Créez un compte professionnel, renseignez votre entreprise et publiez vos produits. Après validation, vous gérez stock, réservations, livraisons, retours et revenus depuis votre espace." },
];

export default async function HomePage() {
  const [actor, tree, cities, popular, featured, lenders, counts, reviews] = await Promise.all([
    getActor(),
    listCategoryTree(),
    listCities(),
    popularProducts(8),
    featuredProducts(6),
    recommendedLenders(6),
    Promise.all([
      db.lender.count({ where: { status: "APPROVED" } }),
      db.product.count({ where: { status: "PUBLISHED", deletedAt: null, lender: { status: "APPROVED" } } }),
      db.city.count({ where: { active: true } }),
      db.reservation.count({ where: { status: { notIn: ["HOLD", "DRAFT", "CANCELLED"] } } }),
    ]),
    db.review.findMany({ where: { status: "PUBLISHED", comment: { not: null }, productRating: { gte: 4 } }, include: { client: { select: { firstName: true, lastName: true } }, product: { select: { name: true, slug: true } }, lender: { select: { companyName: true } } }, orderBy: [{ createdAt: "desc" }], take: 3 }),
  ]);
  const signedIn = Boolean(actor);
  const isClient = actor?.accountType === "CLIENT";
  const favorites = isClient ? new Set((await db.favorite.findMany({ where: { userId: actor!.userId }, select: { productId: true } })).map((f) => f.productId)) : new Set<string>();
  const [lendersCount, productsCount, citiesCount, reservationsCount] = counts;
  const topCategories = tree.slice(0, 6);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "LOC'CONNECT",
    url: process.env.APP_URL ?? "http://localhost:3000",
    potentialAction: { "@type": "SearchAction", target: `${process.env.APP_URL ?? "http://localhost:3000"}/catalogue?q={search_term_string}`, "query-input": "required name=search_term_string" },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Hero */}
      <section className="relative isolate overflow-hidden bg-navy text-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 pb-14 pt-10 sm:px-6 lg:grid-cols-[1.25fr_1fr] lg:items-center lg:gap-14 lg:pb-20 lg:pt-16">
          <div>
            <h1 className="text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl lg:text-[3.35rem]">
              Trouvez. Réservez.
              <br className="hidden sm:block" /> Louez en toute simplicité.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-white/80">
              LOC&apos;CONNECT vous permet de trouver les équipements dont vous avez besoin auprès de loueurs vérifiés, selon vos dates et votre localisation.
            </p>
            <div className="mt-8">
              <SearchForm cities={cities} />
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

      {/* Chiffres */}
      <section aria-label="LOC'CONNECT en chiffres" className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6">
        <dl className="-mt-8 grid grid-cols-2 overflow-hidden rounded-card border border-line bg-surface shadow-card lg:grid-cols-4">
          {[
            { v: lendersCount, l: "loueurs vérifiés", i: <ShieldCheck size={22} /> },
            { v: productsCount, l: "produits à louer", i: <Storefront size={22} /> },
            { v: citiesCount, l: "villes couvertes", i: <MapPin size={22} /> },
            { v: reservationsCount, l: "réservations traitées", i: <CalendarCheck size={22} /> },
          ].map((s, idx) => (
            <div key={s.l} className={`flex items-center gap-4 px-5 py-5 ${idx % 2 === 1 ? "border-l border-line" : ""} ${idx > 1 ? "border-t border-line lg:border-t-0" : ""} ${idx > 0 ? "lg:border-l" : ""}`}>
              <span className="flex size-11 shrink-0 items-center justify-center rounded-control bg-royal-soft text-royal-ink">{s.i}</span>
              <div>
                <dd className="text-2xl font-semibold tabular-nums text-ink">{s.v}</dd>
                <dt className="text-sm text-muted">{s.l}</dt>
              </div>
            </div>
          ))}
        </dl>
      </section>

      {/* Catégories populaires (grille asymétrique) */}
      <section className="mx-auto mt-20 max-w-7xl px-4 sm:px-6" aria-labelledby="h-categories">
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 id="h-categories" className="text-3xl font-semibold text-ink">
              Catégories populaires
            </h2>
            <Link href="/categories" className="inline-flex items-center gap-1.5 text-sm font-medium text-royal-ink hover:underline">
              Toutes les catégories <ArrowRight size={16} />
            </Link>
          </div>
        </Reveal>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:grid-rows-3">
          {topCategories.map((c, i) => (
            <Link
              key={c.id}
              href={`/categories/${c.slug}`}
              className={`group relative isolate flex min-h-52 flex-col justify-end overflow-hidden rounded-card ${i === 0 ? "sm:col-span-2 lg:col-span-2 lg:row-span-2 lg:min-h-[26rem]" : "lg:row-span-1"}`}
            >
              <Photo src={c.imageUrl ?? categoryPhoto(c.name)} alt="" w={900} h={700} className="absolute inset-0 -z-10 size-full transition duration-500 group-hover:scale-105" />
              <div className="scrim-navy absolute inset-0 -z-10" />
              <div className="p-5 text-white">
                <span className="mb-3 flex size-10 items-center justify-center rounded-control bg-white/15 backdrop-blur">
                  <CategoryIcon name={c.icon} size={22} />
                </span>
                <h3 className={`font-semibold ${i === 0 ? "text-2xl" : "text-lg"}`}>{c.name}</h3>
                <p className="mt-0.5 text-sm text-white/80">{c._count.products} produit{c._count.products > 1 ? "s" : ""}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

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

      {/* Produits populaires */}
      <section className="mx-auto mt-20 max-w-7xl px-4 sm:px-6" aria-labelledby="h-popular">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="h-popular" className="text-3xl font-semibold text-ink">
            Produits populaires
          </h2>
          <LinkButton href="/catalogue" variant="secondary">
            Voir le catalogue
          </LinkButton>
        </div>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {popular.map((p) => (
            <ProductCard key={p.id} product={p} signedIn={signedIn} isClient={isClient} favorite={favorites.has(p.id)} />
          ))}
        </div>
      </section>

      {/* Comment ça marche */}
      <section id="comment-ca-marche" className="mx-auto mt-24 max-w-7xl scroll-mt-24 px-4 sm:px-6" aria-labelledby="h-how">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.3fr] lg:gap-16">
          <div>
            <h2 id="h-how" className="text-3xl font-semibold text-ink">
              Comment ça marche
            </h2>
            <p className="mt-3 max-w-md text-[17px] text-muted">De la recherche au retour du matériel, chaque étape affiche le prix, les dates, la caution et la prochaine action.</p>
            <LinkButton href="/catalogue" size="lg" className="mt-7">
              Commencer ma recherche
            </LinkButton>
          </div>
          <ol className="relative space-y-7 border-l border-line pl-8">
            {[
              { i: <MagnifyingGlass size={20} />, t: "Cherchez", d: "Filtrez par ville, catégorie et dates. Seuls les produits disponibles sur votre période sont proposés." },
              { i: <CalendarCheck size={20} />, t: "Réservez", d: "Ajoutez du matériel de plusieurs loueurs dans un même panier. Le stock est bloqué pendant votre paiement." },
              { i: <Wallet size={20} />, t: "Payez une fois", d: "Un paiement unique par Orange Money, MTN, Moov, Wave ou carte, réparti automatiquement entre les loueurs." },
              { i: <Receipt size={20} />, t: "Restituez", d: "Au retour, le loueur fait un constat par article. Votre caution est libérée ou ajustée selon cet état des lieux." },
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

      {/* Avantages */}
      <section className="mx-auto mt-24 max-w-7xl px-4 sm:px-6" aria-labelledby="h-why">
        <h2 id="h-why" className="text-3xl font-semibold text-ink">
          Pourquoi louer avec LOC&apos;CONNECT
        </h2>
        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          <div className="rounded-card bg-navy p-7 text-white lg:col-span-2">
            <Handshake size={28} className="text-white/90" />
            <h3 className="mt-5 text-2xl font-semibold">Un seul paiement, plusieurs loueurs</h3>
            <p className="mt-2 max-w-xl text-white/80">Composez un panier avec des tables chez un loueur et un chapiteau chez un autre. Vous payez une fois, nous répartissons le règlement.</p>
          </div>
          <div className="rounded-card bg-royal-soft p-7">
            <ShieldCheck size={28} className="text-royal-ink" />
            <h3 className="mt-5 text-xl font-semibold text-ink">Caution par article</h3>
            <p className="mt-2 text-muted">Chaque article a sa caution, restituée après le constat de retour.</p>
          </div>
          <div className="relative isolate flex min-h-60 flex-col justify-end overflow-hidden rounded-card p-7 text-white">
            <Photo src={IMAGES.trust} alt="" w={700} h={600} className="absolute inset-0 -z-10 size-full" />
            <div className="scrim-navy absolute inset-0 -z-10" />
            <Storefront size={28} />
            <h3 className="mt-4 text-xl font-semibold">Loueurs vérifiés</h3>
            <p className="mt-1 text-white/85">Chaque entreprise est validée avant de publier.</p>
          </div>
          <div className="rounded-card border border-line bg-surface p-7 shadow-card lg:col-span-2">
            <Scales size={28} className="text-royal-ink" />
            <h3 className="mt-5 text-2xl font-semibold text-ink">Retour et litiges encadrés</h3>
            <p className="mt-2 max-w-xl text-muted">Constat avec photos, fenêtre de contestation de 48 heures, caution gelée en cas de désaccord et arbitrage par notre équipe.</p>
          </div>
        </div>
      </section>

      {/* Loueurs recommandés */}
      <section className="mx-auto mt-24 max-w-7xl px-4 sm:px-6" aria-labelledby="h-lenders">
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
      </section>

      {/* Avis clients */}
      {reviews.length > 0 && (
        <section className="mx-auto mt-24 max-w-7xl px-4 sm:px-6" aria-labelledby="h-reviews">
          <h2 id="h-reviews" className="text-3xl font-semibold text-ink">
            Ils ont loué avec nous
          </h2>
          <div className="mt-8 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            {reviews.slice(0, 1).map((r) => (
              <figure key={r.id} className="flex flex-col justify-between rounded-card bg-navy p-8 text-white">
                <blockquote className="line-clamp-4 text-2xl leading-snug sm:text-3xl">&ldquo;{r.comment}&rdquo;</blockquote>
                <figcaption className="mt-6 text-sm text-white/80">
                  {r.client.firstName} {r.client.lastName.slice(0, 1)}. - {r.product.name}, {r.lender.companyName}
                </figcaption>
              </figure>
            ))}
            <div className="grid gap-4">
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
          </div>
        </section>
      )}

      {/* Devenir loueur */}
      <section className="mx-auto mt-24 max-w-7xl px-4 sm:px-6" aria-labelledby="h-lender-cta">
        <div className="relative isolate overflow-hidden rounded-card bg-navy">
          <div className="grid items-center lg:grid-cols-2">
            <div className="p-8 sm:p-12">
              <h2 id="h-lender-cta" className="text-3xl font-semibold text-white sm:text-4xl">
                Votre matériel dort&nbsp;? Faites-le travailler.
              </h2>
              <p className="mt-4 max-w-md text-[17px] text-white/80">Publiez vos produits, gérez stock, réservations, livraisons et retours depuis un seul espace, et recevez vos versements en toute transparence.</p>
              <LinkButton href="/devenir-loueur" variant="inverse" size="lg" className="mt-8">
                Devenir loueur
              </LinkButton>
            </div>
            <Photo src={IMAGES.becomeLender} alt="" w={900} h={700} className="hidden h-full min-h-72 w-full lg:block" />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto mt-24 max-w-3xl px-4 sm:px-6" aria-labelledby="h-faq">
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
