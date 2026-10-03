import { z } from "zod";
import { created, ok, parseBody, parseQuery, route } from "@/lib/http/route";
import { requireLender } from "@/lib/auth/actor";
import { parseDate } from "@/lib/dates";
import { searchProducts } from "@/services/catalog";
import { createProduct, productInput } from "@/services/products";

const query = z.object({
  q: z.string().optional(),
  category: z.string().optional(),
  city: z.string().optional(),
  lender: z.string().optional(),
  minPrice: z.coerce.number().int().min(0).optional(),
  maxPrice: z.coerce.number().int().min(0).optional(),
  start: z.string().optional(),
  end: z.string().optional(),
  available: z.enum(["1", "0"]).optional(),
  featured: z.enum(["1", "0"]).optional(),
  sort: z.enum(["relevance", "price_asc", "price_desc", "newest", "rating"]).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(48).optional(),
});

/** GET /api/products : recherche publique (texte, catégorie, ville, prix, période, disponibilité, tri, pagination). */
export const GET = route(async ({ req }) => {
  const q = parseQuery(req, query);
  const result = await searchProducts({
    q: q.q,
    category: q.category,
    city: q.city,
    lenderId: q.lender,
    minPrice: q.minPrice,
    maxPrice: q.maxPrice,
    start: q.start ? parseDate(q.start) : undefined,
    end: q.end ? parseDate(q.end) : undefined,
    availableOnly: q.available === "1",
    featured: q.featured === "1",
    sort: q.sort,
    page: q.page,
    pageSize: q.pageSize,
  });
  return ok(result.items, 200, { meta: { total: result.total, page: result.page, pageSize: result.pageSize, totalPages: result.totalPages } });
});

/** POST /api/products : un loueur crée un produit (brouillon ou soumis à modération). */
export const POST = route(async ({ req }) => {
  const actor = await requireLender();
  const input = await parseBody(req, productInput);
  return created(await createProduct(actor, input));
});
