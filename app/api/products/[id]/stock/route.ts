import { ok, parseBody, route } from "@/lib/http/route";
import { requireLender } from "@/lib/auth/actor";
import { adjustStock, stockAdjust } from "@/services/products";

/** POST /api/products/:id/stock : ajustement de stock journalisé (jamais sous le stock déjà engagé). */
export const POST = route<{ id: string }>(async ({ req, params }) => {
  const actor = await requireLender();
  return ok(await adjustStock(actor, params.id, await parseBody(req, stockAdjust)));
});
