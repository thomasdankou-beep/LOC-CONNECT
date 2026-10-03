import { created, parseBody, route } from "@/lib/http/route";
import { requireLender } from "@/lib/auth/actor";
import { payoutDetailsInput, requestPayoutDetailsChange } from "@/services/lenders";

/** POST /api/lenders/me/payout-details : demande de modification des coordonnées de versement (autorisation renforcée de l'administration). */
export const POST = route(async ({ req }) => created(await requestPayoutDetailsChange(await requireLender("COMPANY_MANAGE"), await parseBody(req, payoutDetailsInput))));
