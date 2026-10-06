import { ok, parseBody, route } from "@/lib/http/route";
import { requireActor } from "@/lib/auth/actor";
import { reportCashUnpaid, reportUnpaidInput } from "@/services/cash";

/** POST /api/reservations/:id/cash/unpaid : le client n'a pas payé le solde à la remise ; lignes du loueur annulées, caution restituée. */
export const POST = route<{ id: string }>(async ({ req, params }) => {
  const { reason } = await parseBody(req, reportUnpaidInput);
  return ok(await reportCashUnpaid(await requireActor(), params.id, reason));
});
