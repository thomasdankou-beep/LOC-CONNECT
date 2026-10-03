import { z } from "zod";
import { ok, parseQuery, route } from "@/lib/http/route";
import { requireActor } from "@/lib/auth/actor";
import { listDisputes } from "@/services/disputes";

/** GET /api/disputes : litiges visibles selon le rôle. */
export const GET = route(async ({ req }) => {
  const actor = await requireActor();
  const q = parseQuery(req, z.object({ status: z.enum(["OPEN", "UNDER_REVIEW", "WAITING_RESPONSE", "RESOLVED", "REJECTED", "CLOSED"]).optional(), page: z.coerce.number().int().min(1).optional() }));
  return ok(await listDisputes(actor, q));
});
