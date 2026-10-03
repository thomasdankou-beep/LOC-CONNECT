import { ok, route } from "@/lib/http/route";
import { requireLender } from "@/lib/auth/actor";
import { lenderClients } from "@/services/lenders";

/** GET /api/lenders/me/clients : clients ayant loué chez ce loueur. */
export const GET = route(async () => ok(await lenderClients((await requireLender("CUSTOMER_VIEW")).lenderId)));
