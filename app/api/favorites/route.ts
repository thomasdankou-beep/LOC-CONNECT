import { ok, route } from "@/lib/http/route";
import { db } from "@/lib/db";
import { requireClient } from "@/lib/auth/actor";
import { productCardInclude } from "@/services/catalog";

/** GET /api/favorites : produits favoris du client. */
export const GET = route(async () => {
  const actor = await requireClient();
  const rows = await db.favorite.findMany({ where: { userId: actor.userId, product: { status: "PUBLISHED", deletedAt: null } }, include: { product: { include: productCardInclude } }, orderBy: { createdAt: "desc" } });
  return ok(rows.map((r) => r.product));
});
