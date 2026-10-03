import { z } from "zod";
import { ok, parseBody, route } from "@/lib/http/route";
import { requireAdmin } from "@/lib/auth/actor";
import { moderateProduct } from "@/services/products";

/** PATCH /api/admin/products/:id : approuver, refuser (motif obligatoire) ou suspendre un produit. */
export const PATCH = route<{ id: string }>(async ({ req, params }) => {
  const { decision, reason } = await parseBody(req, z.object({ decision: z.enum(["approve", "reject", "suspend"]), reason: z.string().trim().max(500).optional() }));
  return ok(await moderateProduct(await requireAdmin(), params.id, decision, reason));
});
