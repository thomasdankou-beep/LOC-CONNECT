import { ok, route } from "@/lib/http/route";
import { requireActor } from "@/lib/auth/actor";
import { applyModification } from "@/services/modifications";

/** POST .../apply : applique après validation et règlement. Disponibilité revérifiée avec verrouillage. */
export const POST = route<{ id: string; modId: string }>(async ({ params }) => ok(await applyModification(await requireActor(), params.id, params.modId)));
