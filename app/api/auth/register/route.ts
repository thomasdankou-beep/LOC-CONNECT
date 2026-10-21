import { NextResponse } from "next/server";
import { created, parseBody, route } from "@/lib/http/route";
import { rateLimit } from "@/lib/rate-limit";
import { setSessionCookie } from "@/lib/auth/session";
import { register, registerInput } from "@/services/auth";

/** POST /api/auth/register : crée un compte CLIENT ou LOUEUR (en attente de validation). */
export const POST = route(async ({ req, ip }) => {
  rateLimit(`register:${ip}`, 10, 3_600_000);
  const input = await parseBody(req, registerInput);
  const { user, session } = await register(input, { ip, userAgent: req.headers.get("user-agent") });
  await setSessionCookie(session.token, session.expiresAt);
  return created({ id: user.id, email: user.email, accountType: user.accountType }) as NextResponse;
});
