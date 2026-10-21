import { z } from "zod";
import { ok, parseQuery, route } from "@/lib/http/route";
import { requireAdmin } from "@/lib/auth/actor";
import { listUsers } from "@/services/admin";

/** GET /api/admin/users */
export const GET = route(async ({ req }) => ok(await listUsers(await requireAdmin(), parseQuery(req, z.object({ q: z.string().optional(), type: z.string().optional(), status: z.string().optional(), page: z.coerce.number().int().min(1).optional() })))));
