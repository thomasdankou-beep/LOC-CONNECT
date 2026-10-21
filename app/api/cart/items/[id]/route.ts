import { ok, parseBody, route } from "@/lib/http/route";
import { requireClient } from "@/lib/auth/actor";
import { cartItemPatch, removeCartItem, updateCartItem } from "@/services/cart";

/** PATCH /api/cart/items/:id : change la quantité ou les dates d'une ligne. */
export const PATCH = route<{ id: string }>(async ({ req, params }) => {
  const actor = await requireClient();
  return ok(await updateCartItem(actor.userId, params.id, await parseBody(req, cartItemPatch)));
});

/** DELETE /api/cart/items/:id : retire une ligne. */
export const DELETE = route<{ id: string }>(async ({ params }) => {
  await removeCartItem((await requireClient()).userId, params.id);
  return ok({ deleted: true });
});
