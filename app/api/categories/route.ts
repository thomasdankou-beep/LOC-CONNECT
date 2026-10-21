import { ok, route } from "@/lib/http/route";
import { listCategoryTree } from "@/services/catalog";

/** GET /api/categories : catégories racines avec leurs sous-catégories. */
export const GET = route(async () => ok(await listCategoryTree()));
