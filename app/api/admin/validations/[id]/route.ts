import { z } from "zod";
import { ok, parseBody, route } from "@/lib/http/route";
import { requireAdmin } from "@/lib/auth/actor";
import { decideValidation } from "@/services/lenders";

/** PATCH /api/admin/validations/:id : approuve ou rejette. Le demandeur ne peut pas valider sa propre demande. */
export const PATCH = route<{ id: string }>(async ({ req, params }) => {
  const { approve, reason } = await parseBody(req, z.object({ approve: z.boolean(), reason: z.string().trim().max(300).optional() }));
  return ok(await decideValidation(await requireAdmin(), params.id, approve, reason));
});
