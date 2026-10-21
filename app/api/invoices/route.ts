import { z } from "zod";
import { ok, parseQuery, route } from "@/lib/http/route";
import { requireActor } from "@/lib/auth/actor";
import { listInvoices } from "@/services/invoices";

/** GET /api/invoices : factures et avoirs du périmètre de l'acteur (client, loueur ou administration). */
export const GET = route(async ({ req }) =>
  ok(await listInvoices(await requireActor(), parseQuery(req, z.object({ q: z.string().trim().max(100).optional(), kind: z.enum(["RENTAL", "DAMAGE", "CREDIT_NOTE", "SUBSCRIPTION"]).optional(), page: z.coerce.number().int().min(1).optional() })))),
);
