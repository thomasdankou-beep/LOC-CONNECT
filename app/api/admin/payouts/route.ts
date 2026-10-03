import { z } from "zod";
import { created, ok, parseBody, route } from "@/lib/http/route";
import { requireAdmin } from "@/lib/auth/actor";
import { listPayouts } from "@/services/admin";
import { runAllPayouts, runPayout } from "@/services/payouts";

/** GET /api/admin/payouts : versements effectués. */
export const GET = route(async () => ok(await listPayouts(await requireAdmin())));

/** POST /api/admin/payouts : verse un loueur ({ lenderId }) ou tous les loueurs éligibles. Montants gelés et bloqués exclus, déductions compensées. */
export const POST = route(async ({ req }) => {
  const actor = await requireAdmin("ADMIN_PAYOUTS");
  const { lenderId } = await parseBody(req, z.object({ lenderId: z.string().optional() }));
  if (lenderId) return created(await runPayout(actor, lenderId));
  return created(await runAllPayouts(actor));
});
