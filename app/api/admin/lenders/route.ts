import { z } from "zod";
import { ok, parseQuery, route } from "@/lib/http/route";
import { requireAdmin } from "@/lib/auth/actor";
import { listLenders } from "@/services/admin";

/** GET /api/admin/lenders : loueurs (filtre par statut de validation). */
export const GET = route(async ({ req }) => ok(await listLenders(await requireAdmin(), parseQuery(req, z.object({ q: z.string().optional(), status: z.string().optional(), page: z.coerce.number().int().min(1).optional() })))));
