import { ok, route } from "@/lib/http/route";
import { requireAdmin } from "@/lib/auth/actor";
import { listPlatformRoles } from "@/services/admin";

/** GET /api/admin/roles : rôles plateforme et leurs membres. */
export const GET = route(async () => ok(await listPlatformRoles(await requireAdmin())));
