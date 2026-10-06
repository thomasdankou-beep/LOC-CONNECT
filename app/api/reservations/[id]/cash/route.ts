import { ok, parseBody, route } from "@/lib/http/route";
import { requireActor } from "@/lib/auth/actor";
import { cashSettlementsForActor, confirmCashInput, confirmCashPayment } from "@/services/cash";

/** GET /api/reservations/:id/cash : soldes à régler en espèces (le code de remise n'est visible que du client et de l'administration). */
export const GET = route<{ id: string }>(async ({ params }) => ok(await cashSettlementsForActor(await requireActor(), params.id)));

/** POST /api/reservations/:id/cash : le loueur confirme l'encaissement du solde avec le code de remise donné par le client. */
export const POST = route<{ id: string }>(async ({ req, params }) => {
  const { code } = await parseBody(req, confirmCashInput);
  return ok(await confirmCashPayment(await requireActor(), params.id, code));
});
