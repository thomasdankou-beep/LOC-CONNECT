import { z } from "zod";
import { ok, parseBody, route } from "@/lib/http/route";
import { rateLimit } from "@/lib/rate-limit";
import { resetPassword } from "@/services/auth";

/** POST /api/auth/reset-password : choisit un nouveau mot de passe avec le jeton reçu par e-mail. */
export const POST = route(async ({ req, ip }) => {
  rateLimit(`reset:${ip}`, 10, 3_600_000);
  const { token, password } = await parseBody(req, z.object({ token: z.string().min(10), password: z.string() }));
  await resetPassword(token, password, { ip, userAgent: req.headers.get("user-agent") });
  return ok({ reset: true });
});
