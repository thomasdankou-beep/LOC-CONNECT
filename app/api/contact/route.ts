import { created, parseBody, route } from "@/lib/http/route";
import { rateLimit } from "@/lib/rate-limit";
import { getActor } from "@/lib/auth/actor";
import { contactInput, submitContact } from "@/services/contact";

/** POST /api/contact : message envoyé depuis la page contact (public, limité par IP, champ piège anti-robots). */
export const POST = route(async ({ req, ip }) => {
  rateLimit(`contact:${ip}`, 5, 3_600_000);
  const input = await parseBody(req, contactInput);
  const actor = await getActor();
  return created(await submitContact(input, actor?.userId));
});
