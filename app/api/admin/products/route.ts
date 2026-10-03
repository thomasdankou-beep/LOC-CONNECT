import { z } from "zod";
import { ok, parseQuery, route } from "@/lib/http/route";
import { requireAdmin } from "@/lib/auth/actor";
import { listProducts } from "@/services/admin";

/** GET /api/admin/products */
export const GET = route(async ({ req }) => ok(await listProducts(await requireAdmin(), parseQuery(req, z.object({ q: z.string().optional(), status: z.string().optional(), page: z.coerce.number().int().min(1).optional() })))));
