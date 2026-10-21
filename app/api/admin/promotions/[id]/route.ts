import { z } from "zod";
import { ok, parseBody, route } from "@/lib/http/route";
import { requireAdmin } from "@/lib/auth/actor";
import { togglePromotion } from "@/services/admin";

/** PATCH /api/admin/promotions/:id : active ou désactive une mise en avant. */
export const PATCH = route<{ id: string }>(async ({ req, params }) => ok(await togglePromotion(await requireAdmin(), params.id, (await parseBody(req, z.object({ active: z.boolean() }))).active)));
