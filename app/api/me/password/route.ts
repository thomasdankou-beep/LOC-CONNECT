import { z } from "zod";
import { ok, parseBody, route } from "@/lib/http/route";
import { requireActor } from "@/lib/auth/actor";
import { clearSessionCookie } from "@/lib/auth/session";
import { changePassword } from "@/services/auth";

/** POST /api/me/password : change le mot de passe et révoque toutes les sessions. */
export const POST = route(async ({ req }) => {
  const actor = await requireActor();
  const { current, next } = await parseBody(req, z.object({ current: z.string().min(1), next: z.string() }));
  await changePassword(actor.userId, current, next, actor.meta);
  await clearSessionCookie();
  return ok({ changed: true });
});
