import { ok, parseBody, route } from "@/lib/http/route";
import { requireAdmin } from "@/lib/auth/actor";
import { cityInput, upsertCity } from "@/services/admin";

/** PATCH /api/admin/cities/:id */
export const PATCH = route<{ id: string }>(async ({ req, params }) => ok(await upsertCity(await requireAdmin(), params.id, (await parseBody(req, cityInput.partial())) as never)));
