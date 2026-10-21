import { ok, route } from "@/lib/http/route";
import { requireAdmin } from "@/lib/auth/actor";
import { listAdminDeliveries } from "@/services/deliveries";

/** GET /api/admin/deliveries */
export const GET = route(async ({ req }) => {
  await requireAdmin("ADMIN_DELIVERIES");
  return ok(await listAdminDeliveries(Number(req.nextUrl.searchParams.get("page") ?? 1)));
});
