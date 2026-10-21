import { z } from "zod";
import { ok, parseQuery, route } from "@/lib/http/route";
import { requireAdmin } from "@/lib/auth/actor";
import { listRecoveries } from "@/services/payouts";

/** GET /api/admin/recoveries : montants à recouvrer auprès des loueurs après remboursement d'un client. */
export const GET = route(async ({ req }) => {
  await requireAdmin("ADMIN_RECOVERIES");
  return ok(await listRecoveries(parseQuery(req, z.object({ status: z.string().optional(), page: z.coerce.number().int().min(1).optional() }))));
});
