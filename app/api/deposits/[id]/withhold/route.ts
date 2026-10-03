import { z } from "zod";
import { ok, parseBody, route } from "@/lib/http/route";
import { requireActor } from "@/lib/auth/actor";
import { withholdDeposit } from "@/services/returns";

/** PATCH /api/deposits/:id/withhold : retenue décidée par l'administration (plafonnée par la caution, motif obligatoire, auditée). */
export const PATCH = route<{ id: string }>(async ({ req, params }) => {
  const { amount, reason } = await parseBody(req, z.object({ amount: z.number().int().min(0), reason: z.string().trim().min(5).max(500) }));
  return ok(await withholdDeposit(await requireActor(), params.id, amount, reason));
});
