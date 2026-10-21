import { ok, route } from "@/lib/http/route";
import { getLenderPublic } from "@/services/catalog";

/** GET /api/lenders/public/:slug : profil public d'un loueur validé. */
export const GET = route<{ slug: string }>(async ({ params }) => {
  const l = await getLenderPublic(params.slug);
  return ok({ id: l.id, slug: l.slug, companyName: l.companyName, description: l.description, logoUrl: l.logoUrl, coverUrl: l.coverUrl, city: l.city.name, ratingAvg: l.ratingAvg, reviewCount: l.reviewCount, offersDelivery: l.offersDelivery });
});
