import { z } from "zod";
import { ok, parseBody, route } from "@/lib/http/route";
import { requireActor } from "@/lib/auth/actor";
import { simulatePayment } from "@/services/payments";

/** POST /api/payments/:id/simulate : DÉMONSTRATION. Déclenche un webhook signé de réussite ou d'échec. Aucun paiement réel. */
export const POST = route<{ id: string }>(async ({ req, params }) => {
  const { outcome } = await parseBody(req, z.object({ outcome: z.enum(["success", "failure"]) }));
  return ok(await simulatePayment(await requireActor(), params.id, outcome));
});
