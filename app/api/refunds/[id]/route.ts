import { ok, route } from "@/lib/http/route";
import { requireActor } from "@/lib/auth/actor";
import { getRefundForActor } from "@/services/refunds";

/** GET /api/refunds/:id : détail d'un remboursement. */
export const GET = route<{ id: string }>(async ({ params }) => ok(await getRefundForActor(await requireActor(), params.id)));
