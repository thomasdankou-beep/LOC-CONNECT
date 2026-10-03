import { ok, route } from "@/lib/http/route";
import { requireActor } from "@/lib/auth/actor";
import { lenderSplits } from "@/services/payments";

/** GET /api/payments/:id/lender-splits : répartition comptable entre loueurs (commission, net, caution). */
export const GET = route<{ id: string }>(async ({ params }) => ok(await lenderSplits(await requireActor(), params.id)));
