import { ok, route } from "@/lib/http/route";
import { requireLender } from "@/lib/auth/actor";
import { listPermissions } from "@/services/lenders";

/** GET /api/lenders/me/permissions : catalogue des permissions granulaires. */
export const GET = route(async () => {
  await requireLender("TEAM_MANAGE");
  return ok(await listPermissions());
});
