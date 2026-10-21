import { ok, parseBody, route } from "@/lib/http/route";
import { requireAdmin } from "@/lib/auth/actor";
import { markRecovered, recoveryUpdate } from "@/services/payouts";

/** PATCH /api/admin/recoveries/:id : enregistre un recouvrement manuel (RECOVERED). La compensation sur versement est automatique. */
export const PATCH = route<{ id: string }>(async ({ req, params }) => ok(await markRecovered(await requireAdmin("ADMIN_RECOVERIES"), params.id, (await parseBody(req, recoveryUpdate)).note)));
