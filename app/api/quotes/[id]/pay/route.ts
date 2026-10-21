import { created, route } from "@/lib/http/route";
import { requireClient } from "@/lib/auth/actor";
import { getSettings } from "@/lib/settings";
import { rateLimit } from "@/lib/rate-limit";
import { payQuote } from "@/services/quotes";

/** POST /api/quotes/:id/pay : bloque le stock avec les lignes de la proforma, au montant annoncé (PRICE_CHANGED sinon), puis paiement comme un panier. */
export const POST = route<{ id: string }>(async ({ params, ip }) => {
  const actor = await requireClient();
  const settings = await getSettings();
  rateLimit(`hold:user:${actor.userId}`, settings["ratelimit.hold_per_minute"], 60_000);
  rateLimit(`hold:ip:${ip}`, settings["ratelimit.hold_per_minute"] * 3, 60_000);
  const hold = await payQuote(actor.userId, params.id, actor.meta);
  return created({ id: hold.id });
});
