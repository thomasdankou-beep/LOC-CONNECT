import { ok, route } from "@/lib/http/route";
import { requireAdmin } from "@/lib/auth/actor";
import { dashboardStats } from "@/services/admin";

/** GET /api/admin/stats : indicateurs du tableau de bord. */
export const GET = route(async () => ok(await dashboardStats(await requireAdmin("ADMIN_DASHBOARD"))));
