import { created, ok, parseBody, route } from "@/lib/http/route";
import { requireAdmin } from "@/lib/auth/actor";
import { listSubscriptions } from "@/services/admin";
import { adminPlanInput, adminSetPlan } from "@/services/plans";

/** GET /api/admin/subscriptions : historique des abonnements (Gratuit, PRO, PREMIUM). */
export const GET = route(async () => ok(await listSubscriptions(await requireAdmin())));

/** POST /api/admin/subscriptions : active une formule (la précédente est clôturée et conservée). */
export const POST = route(async ({ req }) => created(await adminSetPlan(await requireAdmin(), await parseBody(req, adminPlanInput))));
