import { ok, route } from "@/lib/http/route";
import { requireClient } from "@/lib/auth/actor";
import { expireHold } from "@/services/holds";

/** POST /api/holds/:id/expire : expiration immédiate (abandon du paiement). Le stock est libéré. */
export const POST = route<{ id: string }>(async ({ params }) => {
  await expireHold((await requireClient()).userId, params.id);
  return ok({ expired: true });
});
