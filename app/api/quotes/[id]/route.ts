import { ok, route } from "@/lib/http/route";
import { requireActor } from "@/lib/auth/actor";
import { getQuoteForActor } from "@/services/quotes";

/** GET /api/quotes/:id : contenu figé de la proforma et son état (à payer, payée, expirée). */
export const GET = route<{ id: string }>(async ({ params }) => ok(await getQuoteForActor(await requireActor(), params.id)));
