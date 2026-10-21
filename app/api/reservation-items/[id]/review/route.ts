import { created, parseBody, route } from "@/lib/http/route";
import { requireClient } from "@/lib/auth/actor";
import { createReview, reviewInput } from "@/services/reviews";

/** POST /api/reservation-items/:id/review : avis sur le produit, le loueur et l'expérience, après une location terminée. */
export const POST = route<{ id: string }>(async ({ req, params }) => created(await createReview(await requireClient(), params.id, await parseBody(req, reviewInput))));
