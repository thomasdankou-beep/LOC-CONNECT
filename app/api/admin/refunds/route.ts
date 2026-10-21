import { ok, route } from "@/lib/http/route";
import { requireAdmin } from "@/lib/auth/actor";
import { listRefunds } from "@/services/admin";

/** GET /api/admin/refunds */
export const GET = route(async ({ req }) => ok(await listRefunds(await requireAdmin(), { page: Number(req.nextUrl.searchParams.get("page") ?? 1) })));
