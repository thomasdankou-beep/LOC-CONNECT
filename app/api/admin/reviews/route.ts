import { z } from "zod";
import { ok, parseQuery, route } from "@/lib/http/route";
import { requireAdmin } from "@/lib/auth/actor";
import { listReviews } from "@/services/admin";

/** GET /api/admin/reviews */
export const GET = route(async ({ req }) => ok(await listReviews(await requireAdmin(), parseQuery(req, z.object({ q: z.string().optional(), status: z.string().optional(), page: z.coerce.number().int().min(1).optional() })))));
