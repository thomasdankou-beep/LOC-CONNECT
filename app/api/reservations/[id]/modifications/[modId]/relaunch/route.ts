import { z } from "zod";
import { ok, parseBody, route } from "@/lib/http/route";
import { requireActor } from "@/lib/auth/actor";
import { relaunchModification } from "@/services/modifications";

/** POST .../relaunch : l'administration relance le loueur avec un délai supplémentaire (escalade). */
export const POST = route<{ id: string; modId: string }>(async ({ req, params }) => {
  const { extraHours } = await parseBody(req, z.object({ extraHours: z.number().int().min(1).max(48).default(2) }));
  return ok(await relaunchModification(await requireActor(), params.id, params.modId, extraHours));
});
