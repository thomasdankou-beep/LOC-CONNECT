import { created, ok, parseBody, route } from "@/lib/http/route";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/actor";
import { categoryInput, upsertCategory } from "@/services/admin";

/** GET /api/admin/categories : catégories et sous-catégories (y compris inactives). */
export const GET = route(async () => {
  await requireAdmin("ADMIN_CATALOG");
  return ok(await db.category.findMany({ include: { parent: { select: { name: true } }, _count: { select: { products: true } } }, orderBy: [{ parentId: "asc" }, { position: "asc" }] }));
});

/** POST /api/admin/categories : crée une catégorie ou une sous-catégorie (parentId). */
export const POST = route(async ({ req }) => created(await upsertCategory(await requireAdmin(), null, await parseBody(req, categoryInput))));
