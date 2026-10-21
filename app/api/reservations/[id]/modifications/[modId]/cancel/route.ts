import { ok, route } from "@/lib/http/route";
import { requireClient } from "@/lib/auth/actor";
import { cancelModification } from "@/services/modifications";

/** POST .../cancel : le client annule sa demande avant application. */
export const POST = route<{ id: string; modId: string }>(async ({ params }) => ok(await cancelModification(await requireClient(), params.id, params.modId)));
