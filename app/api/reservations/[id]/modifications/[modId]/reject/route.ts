import { z } from "zod";
import { ok, parseBody, route } from "@/lib/http/route";
import { requireActor } from "@/lib/auth/actor";
import { rejectModification } from "@/services/modifications";

/** POST .../reject : refus motivé par le loueur ou l'administration. */
export const POST = route<{ id: string; modId: string }>(async ({ req, params }) => {
  const { reason } = await parseBody(req, z.object({ reason: z.string().trim().min(3).max(500) }));
  return ok(await rejectModification(await requireActor(), params.id, params.modId, reason));
});
