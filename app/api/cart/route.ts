import { ok, route } from "@/lib/http/route";
import { requireClient } from "@/lib/auth/actor";
import { clearCart, getCart } from "@/services/cart";

/** GET /api/cart : panier recalculé côté serveur (prix, caution, disponibilité réelle de chaque ligne). */
export const GET = route(async () => ok(await getCart((await requireClient()).userId)));

/** DELETE /api/cart : vide le panier. */
export const DELETE = route(async () => {
  await clearCart((await requireClient()).userId);
  return ok({ cleared: true });
});
