import { ok, route } from "@/lib/http/route";
import { requireActor } from "@/lib/auth/actor";
import { listLenderImpacts } from "@/services/refunds";

/** GET /api/refunds/:id/lender-impacts : part supportée par chaque loueur et état du recouvrement. */
export const GET = route<{ id: string }>(async ({ params }) => ok(await listLenderImpacts(await requireActor(), params.id)));
