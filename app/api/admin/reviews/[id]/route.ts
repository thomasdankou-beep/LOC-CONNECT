import { z } from "zod";
import { ok, parseBody, route } from "@/lib/http/route";
import { requireAdmin } from "@/lib/auth/actor";
import { moderateReview } from "@/services/reviews";

/** PATCH /api/admin/reviews/:id : publier ou masquer un avis. */
export const PATCH = route<{ id: string }>(async ({ req, params }) => ok(await moderateReview(await requireAdmin(), params.id, (await parseBody(req, z.object({ status: z.enum(["PUBLISHED", "HIDDEN"]) }))).status)));
