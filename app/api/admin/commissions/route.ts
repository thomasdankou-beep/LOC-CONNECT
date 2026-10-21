import { ok, route } from "@/lib/http/route";
import { requireAdmin } from "@/lib/auth/actor";
import { commissionSummary } from "@/services/admin";

/** GET /api/admin/commissions : commissions perçues par loueur et taux par défaut. */
export const GET = route(async () => ok(await commissionSummary(await requireAdmin())));
