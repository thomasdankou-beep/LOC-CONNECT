import { ok, route } from "@/lib/http/route";
import { clearSessionCookie, readSession, revokeSession } from "@/lib/auth/session";

/** POST /api/auth/logout : révoque la session côté serveur et supprime le cookie. */
export const POST = route(async () => {
  const session = await readSession();
  if (session) await revokeSession(session.sessionId);
  await clearSessionCookie();
  return ok({ loggedOut: true });
});
