import { z } from "zod";
import { ok, parseQuery, route } from "@/lib/http/route";
import { requireAdmin } from "@/lib/auth/actor";
import { listCashSettlements } from "@/services/cash";

/** GET /api/admin/cash : soldes payés en espèces aux loueurs, par statut. */
export const GET = route(async ({ req }) =>
  ok(await listCashSettlements(await requireAdmin(), parseQuery(req, z.object({ q: z.string().trim().max(100).optional(), status: z.enum(["PENDING", "PAID", "UNPAID", "CANCELLED"]).optional(), page: z.coerce.number().int().min(1).optional() })))),
);
