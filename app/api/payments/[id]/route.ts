import { ok, route } from "@/lib/http/route";
import { requireActor } from "@/lib/auth/actor";
import { getPaymentForActor } from "@/services/payments";

/** GET /api/payments/:id : détail d'un paiement (client propriétaire, loueur concerné, finance). */
export const GET = route<{ id: string }>(async ({ params }) => ok(await getPaymentForActor(await requireActor(), params.id)));
