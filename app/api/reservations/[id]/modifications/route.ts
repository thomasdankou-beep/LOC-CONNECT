import { created, ok, parseBody, route } from "@/lib/http/route";
import { requireActor, requireClient } from "@/lib/auth/actor";
import { listModifications, modificationInput, requestModification } from "@/services/modifications";

/** POST /api/reservations/:id/modifications : crée une demande de modification (jamais d'écrasement direct). */
export const POST = route<{ id: string }>(async ({ req, params }) => {
  const actor = await requireClient();
  return created(await requestModification(actor, params.id, await parseBody(req, modificationInput)));
});

/** GET /api/reservations/:id/modifications : historique des demandes. */
export const GET = route<{ id: string }>(async ({ params }) => ok(await listModifications(await requireActor(), params.id)));
