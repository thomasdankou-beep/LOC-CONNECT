import { ok, route } from "@/lib/http/route";
import { requireLender } from "@/lib/auth/actor";
import { listLenderPayouts } from "@/services/payouts";

/** GET /api/lenders/me/payouts : versements reçus. */
export const GET = route(async () => ok(await listLenderPayouts((await requireLender("PAYOUT_VIEW")).lenderId)));
