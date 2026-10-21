import { created, parseBody, route } from "@/lib/http/route";
import { requireClient } from "@/lib/auth/actor";
import { addToCart, cartItemInput } from "@/services/cart";

/** POST /api/cart/items : ajoute un produit avec ses dates et sa quantité (disponibilité vérifiée). */
export const POST = route(async ({ req }) => {
  const actor = await requireClient();
  return created(await addToCart(actor.userId, await parseBody(req, cartItemInput)));
});
