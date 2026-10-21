import { ok, parseBody, route } from "@/lib/http/route";
import { requireClient } from "@/lib/auth/actor";
import { modificationInput, previewModification } from "@/services/modifications";

/** POST /api/reservations/:id/modifications/preview : calcule complément, remboursement, caution et commission sans rien créer. */
export const POST = route<{ id: string }>(async ({ req, params }) => ok(await previewModification(await requireClient(), params.id, await parseBody(req, modificationInput))));
