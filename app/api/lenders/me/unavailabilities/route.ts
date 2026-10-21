import { created, ok, parseBody, route } from "@/lib/http/route";
import { requireLender } from "@/lib/auth/actor";
import { createUnavailability, listUnavailabilities, unavailabilityInput } from "@/services/lenders";

/** GET /api/lenders/me/unavailabilities : périodes d'indisponibilité du loueur. */
export const GET = route(async () => ok(await listUnavailabilities((await requireLender("CALENDAR_MANAGE")).lenderId)));

/** POST /api/lenders/me/unavailabilities : bloque les nouvelles réservations sur une période. */
export const POST = route(async ({ req }) => created(await createUnavailability(await requireLender("CALENDAR_MANAGE"), await parseBody(req, unavailabilityInput))));
