import { ok, route } from "@/lib/http/route";
import { getActor } from "@/lib/auth/actor";
import { unreadCount } from "@/services/notifications";
import { cartCount } from "@/services/cart";

/** GET /api/auth/me : utilisateur courant, rôle, entreprise et permissions effectives. */
export const GET = route(async () => {
  const actor = await getActor();
  if (!actor) return ok({ user: null });
  const [unread, cart] = await Promise.all([unreadCount(actor.userId), actor.accountType === "CLIENT" ? cartCount(actor.userId) : Promise.resolve(0)]);
  return ok({
    user: { id: actor.userId, email: actor.email, firstName: actor.firstName, lastName: actor.lastName, accountType: actor.accountType, lender: actor.lenderId ? { id: actor.lenderId, name: actor.lenderName, status: actor.lenderStatus, owner: actor.isLenderOwner } : null, permissions: [...actor.permissions], unreadNotifications: unread, cartCount: cart },
  });
}, { skipRateLimit: true });
