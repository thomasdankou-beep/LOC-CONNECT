import { z } from "zod";
import { ok, parseQuery, route } from "@/lib/http/route";
import { requireAdmin } from "@/lib/auth/actor";
import { listDisputes } from "@/services/disputes";

/** GET /api/admin/disputes : tous les litiges. Décision via PATCH /api/disputes/:id. */
export const GET = route(async ({ req }) => ok(await listDisputes(await requireAdmin("ADMIN_DISPUTES"), parseQuery(req, z.object({ status: z.enum(["OPEN", "UNDER_REVIEW", "WAITING_RESPONSE", "RESOLVED", "REJECTED", "CLOSED"]).optional(), page: z.coerce.number().int().min(1).optional() })))));
