import { created, ok, parseBody, route } from "@/lib/http/route";
import { requireActor, requireClient } from "@/lib/auth/actor";
import { getSettings } from "@/lib/settings";
import { rateLimit } from "@/lib/rate-limit";
import { createQuote, listQuotes, quoteInput } from "@/services/quotes";

/** GET /api/quotes : proformas du client (toutes pour l'administration). */
export const GET = route(async () => ok(await listQuotes(await requireActor())));

/** POST /api/quotes : proforma du panier (mode de remise, adresse, créneaux), valable `quote.validity_days` jours. Ne bloque pas le stock. */
export const POST = route(async ({ req }) => {
  const actor = await requireClient();
  const settings = await getSettings();
  rateLimit(`quote:user:${actor.userId}`, settings["ratelimit.hold_per_minute"], 60_000);
  const quote = await createQuote(actor.userId, await parseBody(req, quoteInput), actor.meta);
  return created({ id: quote.id, number: quote.number });
});
