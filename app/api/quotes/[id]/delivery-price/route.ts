import { requireLender } from "@/lib/auth/actor";
import { ok, parseBody, route } from "@/lib/http/route";
import { confirmDeliveryPrice, deliveryPriceInput } from "@/services/quotes";

export const POST = route<{ id: string }>(async ({ req, params }) => {
  const actor = await requireLender("DELIVERY_UPDATE");
  await confirmDeliveryPrice(actor, params.id, await parseBody(req, deliveryPriceInput));
  return ok({ confirmed: true });
});
