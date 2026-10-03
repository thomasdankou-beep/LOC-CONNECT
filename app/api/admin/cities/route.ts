import { created, ok, parseBody, route } from "@/lib/http/route";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/actor";
import { cityInput, upsertCity } from "@/services/admin";

/** GET /api/admin/cities */
export const GET = route(async () => {
  await requireAdmin("ADMIN_CATALOG");
  return ok(await db.city.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { products: true, lenders: true } } } }));
});

/** POST /api/admin/cities */
export const POST = route(async ({ req }) => created(await upsertCity(await requireAdmin(), null, await parseBody(req, cityInput))));
