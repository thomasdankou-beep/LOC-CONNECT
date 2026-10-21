import { z } from "zod";
import { ok, parseBody, route } from "@/lib/http/route";
import { requireLender } from "@/lib/auth/actor";
import { setProductStatus } from "@/services/products";

/** POST /api/products/:id/status : publier (soumettre à modération), désactiver ou réactiver. */
export const POST = route<{ id: string }>(async ({ req, params }) => {
  const actor = await requireLender();
  const { action } = await parseBody(req, z.object({ action: z.enum(["publish", "deactivate", "reactivate"]) }));
  return ok(await setProductStatus(actor, params.id, action));
});
