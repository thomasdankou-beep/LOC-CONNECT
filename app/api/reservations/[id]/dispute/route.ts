import { created, parseBody, route } from "@/lib/http/route";
import { requireClient } from "@/lib/auth/actor";
import { disputeInput, openDispute } from "@/services/disputes";

/** POST /api/reservations/:id/dispute : ouvre un litige ciblé sur un loueur (les autres loueurs ne sont pas impactés). */
export const POST = route<{ id: string }>(async ({ req, params }) => {
  const actor = await requireClient();
  const input = await parseBody(req, disputeInput);
  return created(await openDispute(actor, { ...input, reservationId: params.id }));
});
