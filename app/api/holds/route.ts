import { created, parseBody, route } from "@/lib/http/route";
import { requireClient } from "@/lib/auth/actor";
import { getSettings } from "@/lib/settings";
import { rateLimit } from "@/lib/rate-limit";
import { createHold, holdInput } from "@/services/holds";
import { maybeRunMaintenance } from "@/services/maintenance";

/**
 * POST /api/holds : bloque temporairement le stock du panier. Rate limiting dédié (distinct du limiteur général),
 * limite de HOLD actifs par client, durée réduite pour les clients à fort taux de HOLD non convertis.
 */
export const POST = route(async ({ req, ip }) => {
  const actor = await requireClient();
  const settings = await getSettings();
  rateLimit(`hold:user:${actor.userId}`, settings["ratelimit.hold_per_minute"], 60_000);
  rateLimit(`hold:ip:${ip}`, settings["ratelimit.hold_per_minute"] * 3, 60_000);
  await maybeRunMaintenance();
  const input = await parseBody(req, holdInput);
  const hold = await createHold(actor.userId, input, actor.meta);
  return created({ ...hold, secondsLeft: Math.max(0, Math.floor((hold.expiresAt.getTime() - Date.now()) / 1000)) });
});
