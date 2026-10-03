import { ok, route } from "@/lib/http/route";
import { requireAdmin } from "@/lib/auth/actor";
import { listReturns } from "@/services/admin";

/** GET /api/admin/returns */
export const GET = route(async ({ req }) => ok(await listReturns(await requireAdmin(), { page: Number(req.nextUrl.searchParams.get("page") ?? 1) })));
