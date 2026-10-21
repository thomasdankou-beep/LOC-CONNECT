import { z } from "zod";
import { ok, parseBody, route } from "@/lib/http/route";
import { requireActor } from "@/lib/auth/actor";
import { listNotifications, markRead, unreadCount } from "@/services/notifications";

/** GET /api/me/notifications : notifications internes de l'utilisateur. */
export const GET = route(async ({ req }) => {
  const actor = await requireActor();
  const unreadOnly = req.nextUrl.searchParams.get("unread") === "1";
  const [items, unread] = await Promise.all([listNotifications(actor.userId, { unreadOnly }), unreadCount(actor.userId)]);
  return ok({ items, unread });
});

/** POST /api/me/notifications : marque une notification (ou toutes) comme lue. */
export const POST = route(async ({ req }) => {
  const actor = await requireActor();
  const { id } = await parseBody(req, z.object({ id: z.string().optional() }));
  await markRead(actor.userId, id);
  return ok({ read: true });
});
