import { ok, parseBody, route } from "@/lib/http/route";
import { requireAdmin } from "@/lib/auth/actor";
import { categoryInput, upsertCategory } from "@/services/admin";

/** PATCH /api/admin/categories/:id */
export const PATCH = route<{ id: string }>(async ({ req, params }) => ok(await upsertCategory(await requireAdmin(), params.id, (await parseBody(req, categoryInput.partial())) as never)));
