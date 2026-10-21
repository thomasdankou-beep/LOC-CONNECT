import { z } from "zod";
import { ok, parseBody, route } from "@/lib/http/route";
import { db } from "@/lib/db";
import { AppError, notFound } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { parseDate } from "@/lib/dates";
import { requireClient } from "@/lib/auth/actor";

const input = z.object({
  lenderId: z.string().optional(),
  address: z.string().trim().min(5).max(300).optional(),
  zone: z.string().trim().max(120).optional(),
  scheduledDate: z.string().optional(),
  slotStart: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  slotEnd: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  notes: z.string().trim().max(500).optional(),
});

/** POST /api/reservations/:id/delivery : le client précise adresse, zone, date et créneau de livraison avant la préparation. */
export const POST = route<{ id: string }>(async ({ req, params }) => {
  const actor = await requireClient();
  const body = await parseBody(req, input);
  const reservation = await db.reservation.findFirst({ where: { id: params.id, clientId: actor.userId }, include: { deliveries: true } });
  if (!reservation) throw notFound("Réservation");
  if (reservation.fulfillmentType !== "DELIVERY") throw new AppError("CONFLICT", "Cette réservation est en retrait chez le loueur.");
  const targets = reservation.deliveries.filter((d) => (body.lenderId ? d.lenderId === body.lenderId : true) && ["PENDING", "PREPARING"].includes(d.status));
  if (targets.length === 0) throw new AppError("CONFLICT", "Aucune livraison modifiable.");
  await db.delivery.updateMany({
    where: { id: { in: targets.map((t) => t.id) } },
    data: { address: body.address, zone: body.zone, scheduledDate: body.scheduledDate ? parseDate(body.scheduledDate) : undefined, slotStart: body.slotStart, slotEnd: body.slotEnd, notes: body.notes },
  });
  await audit(db, { userId: actor.userId, action: "delivery.client_update", entity: "Reservation", entityId: reservation.id, newValue: body, meta: actor.meta });
  return ok(await db.delivery.findMany({ where: { reservationId: reservation.id } }));
});
