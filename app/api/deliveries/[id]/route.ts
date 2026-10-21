import { ok, parseBody, route } from "@/lib/http/route";
import { requireActor, requireLender } from "@/lib/auth/actor";
import { deliveryUpdate, getDeliveryForActor, updateDelivery } from "@/services/deliveries";

/** GET /api/deliveries/:id : suivi d'une livraison. */
export const GET = route<{ id: string }>(async ({ params }) => ok(await getDeliveryForActor(await requireActor(), params.id)));

/** PATCH /api/deliveries/:id : planification (date, créneau, responsable, notes) par le loueur. */
export const PATCH = route<{ id: string }>(async ({ req, params }) => ok(await updateDelivery(await requireLender("DELIVERY_UPDATE"), params.id, await parseBody(req, deliveryUpdate))));
