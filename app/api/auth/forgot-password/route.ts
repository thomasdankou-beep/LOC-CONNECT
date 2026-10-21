import { z } from "zod";
import { ok, parseBody, route } from "@/lib/http/route";
import { rateLimit } from "@/lib/rate-limit";
import { forgotPassword } from "@/services/auth";

/** POST /api/auth/forgot-password : réponse identique que l'e-mail existe ou non (anti-énumération). */
export const POST = route(async ({ req, ip }) => {
  rateLimit(`forgot:${ip}`, 5, 3_600_000);
  const { email } = await parseBody(req, z.object({ email: z.string().email() }));
  const result = await forgotPassword(email, { ip, userAgent: req.headers.get("user-agent") });
  return ok({ sent: true, ...result });
});
