import { z } from "zod";
import { ok, parseBody, route } from "@/lib/http/route";
import { requireLender } from "@/lib/auth/actor";
import { updateDelivery } from "@/services/deliveries";

/** PATCH /api/deliveries/:id/status : fait avancer le suivi (PENDING, PREPARING, OUT_FOR_DELIVERY, DELIVERED, FAILED, RETURNED). */
export const PATCH = route<{ id: string }>(async ({ req, params }) => {
  const { status } = await parseBody(req, z.object({ status: z.enum(["PENDING", "PREPARING", "OUT_FOR_DELIVERY", "DELIVERED", "FAILED", "RETURNED"]) }));
  return ok(await updateDelivery(await requireLender("DELIVERY_UPDATE"), params.id, { status }));
});
