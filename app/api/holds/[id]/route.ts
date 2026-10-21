import { ok, route } from "@/lib/http/route";
import { requireClient } from "@/lib/auth/actor";
import { getHold, releaseHold } from "@/services/holds";

/** GET /api/holds/:id : état du blocage et temps restant. */
export const GET = route<{ id: string }>(async ({ params }) => ok(await getHold((await requireClient()).userId, params.id)));

/** DELETE /api/holds/:id : libère le blocage de stock. */
export const DELETE = route<{ id: string }>(async ({ params }) => {
  const actor = await requireClient();
  await releaseHold(actor.userId, params.id, actor.meta);
  return ok({ released: true });
});
