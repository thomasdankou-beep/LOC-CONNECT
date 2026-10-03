import { ok, route } from "@/lib/http/route";
import { requireAdmin } from "@/lib/auth/actor";
import { listNotificationsAdmin } from "@/services/admin";

/** GET /api/admin/notifications : toutes les notifications (internes, e-mail). */
export const GET = route(async ({ req }) => ok(await listNotificationsAdmin(await requireAdmin(), { page: Number(req.nextUrl.searchParams.get("page") ?? 1) })));
