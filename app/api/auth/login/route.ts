import { ok, parseBody, route } from "@/lib/http/route";
import { rateLimit } from "@/lib/rate-limit";
import { getSettings } from "@/lib/settings";
import { setSessionCookie } from "@/lib/auth/session";
import { login, loginInput } from "@/services/auth";

/** POST /api/auth/login : ouvre une session (cookie httpOnly). Limité par IP, verrouillage progressif par compte. */
export const POST = route(async ({ req, ip }) => {
  const settings = await getSettings();
  rateLimit(`login:${ip}`, settings["ratelimit.login_per_15min"], 15 * 60_000);
  const input = await parseBody(req, loginInput);
  const { user, session } = await login(input, { ip, userAgent: req.headers.get("user-agent") });
  await setSessionCookie(session.token, session.expiresAt);
  const next = user.accountType === "ADMIN" ? "/admin" : user.accountType === "LENDER" ? "/loueur/dashboard" : "/mon-compte";
  return ok({ id: user.id, email: user.email, accountType: user.accountType, next });
});
