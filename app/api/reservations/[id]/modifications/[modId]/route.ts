import { ok, route } from "@/lib/http/route";
import { requireActor } from "@/lib/auth/actor";
import { getModificationForActor } from "@/services/modifications";

/** GET /api/reservations/:id/modifications/:modId : détail d'une demande. */
export const GET = route<{ id: string; modId: string }>(async ({ params }) => ok(await getModificationForActor(await requireActor(), params.id, params.modId)));
