import { z } from "zod";
import { ok, parseBody, route } from "@/lib/http/route";
import { requireActor } from "@/lib/auth/actor";
import { clearSessionCookie } from "@/lib/auth/session";
import { deleteAccount, profileInput, updateProfile } from "@/services/auth";

/** PATCH /api/me : met à jour le profil. */
export const PATCH = route(async ({ req }) => {
  const actor = await requireActor();
  const input = await parseBody(req, profileInput);
  const user = await updateProfile(actor.userId, input, actor.meta);
  return ok({ id: user.id, firstName: user.firstName, lastName: user.lastName, phone: user.phone, deliveryAddress: user.deliveryAddress, cityId: user.cityId });
});

/** DELETE /api/me : désactive et anonymise le compte (les éléments financiers sont conservés). */
export const DELETE = route(async ({ req }) => {
  const actor = await requireActor();
  const { password } = await parseBody(req, z.object({ password: z.string().min(1) }));
  await deleteAccount(actor.userId, password, actor.meta);
  await clearSessionCookie();
  return ok({ deleted: true });
});
