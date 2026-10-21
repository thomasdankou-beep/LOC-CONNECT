import { z } from "zod";
import { ok, parseBody, route } from "@/lib/http/route";
import { requireActor } from "@/lib/auth/actor";
import { releaseDeposit } from "@/services/returns";

/** PATCH /api/deposits/:id/release : libère la caution (constat de retour obligatoire). */
export const PATCH = route<{ id: string }>(async ({ req, params }) => {
  const { note } = await parseBody(req, z.object({ note: z.string().trim().max(300).optional() }));
  return ok(await releaseDeposit(await requireActor(), params.id, note));
});
