import { z } from "zod";
import { created, parseBody, route } from "@/lib/http/route";
import { requireClient } from "@/lib/auth/actor";
import { payModification } from "@/services/modifications";

/** POST .../pay : crée le paiement complémentaire (distinct du paiement initial). Idempotent par clé. */
export const POST = route<{ id: string; modId: string }>(async ({ req, params }) => {
  const actor = await requireClient();
  const { method, idempotencyKey } = await parseBody(req, z.object({ method: z.enum(["ORANGE_MONEY", "MTN_MONEY", "MOOV_MONEY", "WAVE", "CARD"]), idempotencyKey: z.string().min(8).max(100) }));
  return created(await payModification(actor, params.id, params.modId, method, idempotencyKey));
});
