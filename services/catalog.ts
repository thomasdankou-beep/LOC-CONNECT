import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { notFound } from "@/lib/errors";
import { availabilityForProducts, minAvailable } from "./availability";

export type ProductSort = "relevance" | "price_asc" | "price_desc" | "newest" | "rating";

export type ProductSearch = {
  q?: string;
  category?: string; // slug (catégorie ou sous-catégorie)
  city?: string; // slug
  lenderId?: string;
  minPrice?: number;
  maxPrice?: number;
  start?: Date;
  end?: Date;
  availableOnly?: boolean;
  featured?: boolean;
  sort?: ProductSort;
  page?: number;
  pageSize?: number;
};

export const productCardInclude = {
  photos: { orderBy: { position: "asc" }, take: 1 },
  lender: { select: { id: true, slug: true, companyName: true, ratingAvg: true, status: true, plan: true } },
  category: { select: { name: true, slug: true } },
  city: { select: { name: true, slug: true } },
} satisfies Prisma.ProductInclude;

export type ProductCard = Prisma.ProductGetPayload<{ include: typeof productCardInclude }> & { availableQty?: number | null; featured?: boolean };

const PUBLIC_WHERE: Prisma.ProductWhereInput = {
  status: "PUBLISHED",
  deletedAt: null,
  lender: { status: "APPROVED" },
};

function orderBy(sort: ProductSort | undefined): Prisma.ProductOrderByWithRelationInput[] {
  switch (sort) {
    case "price_asc":
      return [{ unitPrice: "asc" }];
    case "price_desc":
      return [{ unitPrice: "desc" }];
    case "newest":
      return [{ createdAt: "desc" }];
    case "rating":
      return [{ ratingAvg: "desc" }, { reviewCount: "desc" }];
    default:
      // Pertinence : les loueurs Premium puis Pro remontent (avantage de leur formule), puis popularité et notes.
      return [{ lender: { plan: "desc" } }, { popularity: "desc" }, { ratingAvg: "desc" }];
  }
}

async function categoryScope(slug: string): Promise<string[] | null> {
  const cat = await db.category.findUnique({ where: { slug }, include: { children: { select: { id: true } } } });
  if (!cat) return null;
  return [cat.id, ...cat.children.map((c) => c.id)];
}

export async function activePromotionProductIds(now = new Date()): Promise<Set<string>> {
  const promos = await db.promotion.findMany({ where: { active: true, startsAt: { lte: now }, endsAt: { gte: now } }, select: { productId: true } });
  return new Set(promos.map((p) => p.productId));
}

export async function searchProducts(search: ProductSearch) {
  const page = Math.max(1, search.page ?? 1);
  const pageSize = Math.min(48, Math.max(1, search.pageSize ?? 12));
  const where: Prisma.ProductWhereInput = { ...PUBLIC_WHERE };
  const and: Prisma.ProductWhereInput[] = [];

  if (search.q?.trim()) {
    const q = search.q.trim();
    and.push({ OR: [{ name: { contains: q, mode: "insensitive" } }, { description: { contains: q, mode: "insensitive" } }, { category: { name: { contains: q, mode: "insensitive" } } }, { lender: { companyName: { contains: q, mode: "insensitive" } } }] });
  }
  if (search.category) {
    const ids = await categoryScope(search.category);
    if (!ids) return { items: [] as ProductCard[], total: 0, page, pageSize, totalPages: 1 };
    and.push({ categoryId: { in: ids } });
  }
  if (search.city) and.push({ city: { slug: search.city } });
  if (search.lenderId) and.push({ lenderId: search.lenderId });
  if (search.minPrice != null) and.push({ unitPrice: { gte: search.minPrice } });
  if (search.maxPrice != null) and.push({ unitPrice: { lte: search.maxPrice } });
  const promoIds = await activePromotionProductIds();
  if (search.featured) and.push({ id: { in: [...promoIds] } });
  if (and.length) where.AND = and;

  const hasPeriod = Boolean(search.start && search.end && search.start < search.end);
  const decorate = (items: ProductCard[], avail: Map<string, number>) =>
    items.map((p) => ({ ...p, availableQty: hasPeriod ? (avail.get(p.id) ?? 0) : null, featured: promoIds.has(p.id) }));

  if (hasPeriod && search.availableOnly) {
    // Le filtre de disponibilité dépend de calculs jour par jour : on borne le jeu de candidats puis on filtre.
    const candidates = await db.product.findMany({ where, include: productCardInclude, orderBy: orderBy(search.sort), take: 400 });
    const avail = await availabilityForProducts(db, candidates.map((c) => c.id), search.start!, search.end!);
    const qty = new Map([...avail].map(([id, days]) => [id, minAvailable(days)]));
    const filtered = candidates.filter((c) => (qty.get(c.id) ?? 0) > 0);
    const total = filtered.length;
    const slice = filtered.slice((page - 1) * pageSize, page * pageSize);
    return { items: decorate(slice, qty), total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
  }

  const [total, rows] = await Promise.all([
    db.product.count({ where }),
    db.product.findMany({ where, include: productCardInclude, orderBy: orderBy(search.sort), skip: (page - 1) * pageSize, take: pageSize }),
  ]);
  const qty = new Map<string, number>();
  if (hasPeriod) {
    const avail = await availabilityForProducts(db, rows.map((r) => r.id), search.start!, search.end!);
    for (const [id, days] of avail) qty.set(id, minAvailable(days));
  }
  return { items: decorate(rows, qty), total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function getProductBySlug(slug: string) {
  const product = await db.product.findFirst({
    where: { slug, status: "PUBLISHED", deletedAt: null, lender: { status: "APPROVED" } },
    include: {
      photos: { orderBy: { position: "asc" } },
      lender: { include: { city: true } },
      category: { include: { parent: true } },
      city: true,
    },
  });
  if (!product) throw notFound("Produit");
  return product;
}

export async function getProductReviews(productId: string, take = 10) {
  return db.review.findMany({
    where: { productId, status: "PUBLISHED" },
    include: { client: { select: { firstName: true, lastName: true } } },
    orderBy: { createdAt: "desc" },
    take,
  });
}

export async function similarProducts(productId: string, categoryId: string, take = 4): Promise<ProductCard[]> {
  const rows = await db.product.findMany({
    where: { ...PUBLIC_WHERE, categoryId, id: { not: productId } },
    include: productCardInclude,
    orderBy: [{ popularity: "desc" }],
    take,
  });
  return rows;
}

export async function popularProducts(take = 8): Promise<ProductCard[]> {
  return db.product.findMany({ where: PUBLIC_WHERE, include: productCardInclude, orderBy: [{ popularity: "desc" }, { ratingAvg: "desc" }], take });
}

/** Page d'accueil : mises en avant payées d'abord, complétées par les produits des loueurs Premium (avantage de la formule). */
export async function featuredProducts(take = 4): Promise<ProductCard[]> {
  const ids = [...(await activePromotionProductIds())];
  const promoted = ids.length ? await db.product.findMany({ where: { ...PUBLIC_WHERE, id: { in: ids } }, include: productCardInclude, take }) : [];
  const premium =
    promoted.length < take
      ? await db.product.findMany({ where: { ...PUBLIC_WHERE, id: { notIn: promoted.map((p) => p.id) }, lender: { status: "APPROVED", plan: "PREMIUM" } }, include: productCardInclude, orderBy: [{ popularity: "desc" }, { ratingAvg: "desc" }], take: take - promoted.length })
      : [];
  return [...promoted, ...premium].map((r) => ({ ...r, featured: true }));
}

/** Catégories racines avec leurs sous-catégories ; `_count.products` agrège les produits publiés de la racine et de ses sous-catégories. */
export async function listCategoryTree() {
  const [roots, counts] = await Promise.all([
    db.category.findMany({ where: { parentId: null, active: true }, include: { children: { where: { active: true }, orderBy: { position: "asc" } } }, orderBy: { position: "asc" } }),
    db.product.groupBy({ by: ["categoryId"], where: { status: "PUBLISHED", deletedAt: null, lender: { status: "APPROVED" } }, _count: true }),
  ]);
  const byId = new Map(counts.map((c) => [c.categoryId, c._count]));
  return roots.map((r) => ({
    ...r,
    children: r.children.map((c) => ({ ...c, productCount: byId.get(c.id) ?? 0 })),
    _count: { products: (byId.get(r.id) ?? 0) + r.children.reduce((a, c) => a + (byId.get(c.id) ?? 0), 0) },
  }));
}

export async function listCities() {
  return db.city.findMany({ where: { active: true }, orderBy: { name: "asc" } });
}

export async function recommendedLenders(take = 6) {
  return db.lender.findMany({
    where: { status: "APPROVED" },
    include: { city: true, _count: { select: { products: { where: { status: "PUBLISHED", deletedAt: null } } } } },
    orderBy: [{ ratingAvg: "desc" }, { reviewCount: "desc" }],
    take,
  });
}

export async function getLenderPublic(slug: string) {
  const lender = await db.lender.findFirst({ where: { slug, status: "APPROVED" }, include: { city: true } });
  if (!lender) throw notFound("Loueur");
  return lender;
}
