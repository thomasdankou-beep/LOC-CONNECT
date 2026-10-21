import { created, ok, route } from "@/lib/http/route";
import { db } from "@/lib/db";
import { forbidden, notFound } from "@/lib/errors";
import { can, requireActor } from "@/lib/auth/actor";

async function loadItem(actor: Awaited<ReturnType<typeof requireActor>>, id: string) {
  const item = await db.reservationItem.findUnique({ where: { id }, include: { deposit: true, reservation: { select: { clientId: true } } } });
  if (!item) throw notFound("Ligne de réservation");
  const allowed =
    (actor.accountType === "CLIENT" && item.reservation.clientId === actor.userId) ||
    (actor.accountType === "LENDER" && item.lenderId === actor.lenderId && can(actor, "DEPOSIT_VIEW")) ||
    (actor.accountType === "ADMIN" && can(actor, "ADMIN_DEPOSITS"));
  if (!allowed) throw forbidden();
  return item;
}

/** GET /api/reservation-items/:id/deposits : caution de la ligne (une caution par ligne). */
export const GET = route<{ id: string }>(async ({ params }) => ok((await loadItem(await requireActor(), params.id)).deposit));

/**
 * POST /api/reservation-items/:id/deposits : garantit l'existence de la caution de la ligne (idempotent).
 * La caution est bloquée automatiquement à la confirmation du paiement ; cette route sert au rattrapage administratif.
 */
export const POST = route<{ id: string }>(async ({ params }) => {
  const actor = await requireActor();
  const item = await loadItem(actor, params.id);
  if (item.deposit) return ok(item.deposit);
  return created(await db.deposit.create({ data: { itemId: item.id, amount: item.depositAmount } }));
});
