import { z } from "zod";
import { ok, parseQuery, route } from "@/lib/http/route";
import { requireAdmin } from "@/lib/auth/actor";
import { listAudit } from "@/services/admin";

/** GET /api/admin/audit : journal d'audit global (utilisateur, action, entité, anciennes et nouvelles valeurs, IP). */
export const GET = route(async ({ req }) => ok(await listAudit(await requireAdmin(), parseQuery(req, z.object({ q: z.string().optional(), entity: z.string().optional(), userId: z.string().optional(), page: z.coerce.number().int().min(1).optional() })))));
