import { ok, parseBody, route } from "@/lib/http/route";
import { requireActor } from "@/lib/auth/actor";
import { cancelInput, cancelReservation } from "@/services/refunds";

/** POST /api/reservations/:id/cancel : annule des lignes (ou tout) et rembourse selon la politique ; effet précisé par ligne et par loueur. */
export const POST = route<{ id: string }>(async ({ req, params }) => {
  const actor = await requireActor();
  return ok(await cancelReservation(actor, params.id, await parseBody(req, cancelInput)));
});
