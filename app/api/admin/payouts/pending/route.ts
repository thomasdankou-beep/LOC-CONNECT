import { ok, route } from "@/lib/http/route";
import { requireAdmin } from "@/lib/auth/actor";
import { pendingPayouts } from "@/services/payouts";

/** GET /api/admin/payouts/pending : soldes par loueur (gelé, bloqué, disponible, déductions, versable). */
export const GET = route(async () => {
  await requireAdmin("ADMIN_PAYOUTS");
  return ok(await pendingPayouts());
});
