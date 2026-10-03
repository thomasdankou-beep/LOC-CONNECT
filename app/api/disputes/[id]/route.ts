import { z } from "zod";
import { ok, parseBody, route } from "@/lib/http/route";
import { requireActor } from "@/lib/auth/actor";
import { AppError } from "@/lib/errors";
import { decideDispute, decisionInput, getDisputeForActor, setDisputeStatus } from "@/services/disputes";

/** GET /api/disputes/:id : litige, messages, pièces jointes et décision. */
export const GET = route<{ id: string }>(async ({ params }) => ok(await getDisputeForActor(await requireActor(), params.id)));

const patch = z.union([z.object({ status: z.enum(["UNDER_REVIEW", "WAITING_RESPONSE", "CLOSED"]) }), decisionInput]);

/** PATCH /api/disputes/:id : l'administration change le statut ou rend une décision (client, loueur ou partielle). */
export const PATCH = route<{ id: string }>(async ({ req, params }) => {
  const actor = await requireActor();
  const body = await parseBody(req, patch);
  if (actor.accountType !== "ADMIN") throw new AppError("FORBIDDEN", "Réservé à l'administration.");
  if ("status" in body) return ok(await setDisputeStatus(actor, params.id, body.status));
  return ok(await decideDispute(actor, params.id, body));
});
