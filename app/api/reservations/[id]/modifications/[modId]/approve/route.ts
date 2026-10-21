import { ok, route } from "@/lib/http/route";
import { requireActor } from "@/lib/auth/actor";
import { approveModification } from "@/services/modifications";

/** POST .../approve : le loueur (ou l'administration en escalade) accepte. Sans complément à payer, la modification est appliquée. */
export const POST = route<{ id: string; modId: string }>(async ({ params }) => ok(await approveModification(await requireActor(), params.id, params.modId)));
