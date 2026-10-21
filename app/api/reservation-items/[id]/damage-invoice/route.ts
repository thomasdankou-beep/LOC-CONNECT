import { ok, route } from "@/lib/http/route";
import { db } from "@/lib/db";
import { forbidden, notFound } from "@/lib/errors";
import { can, requireActor } from "@/lib/auth/actor";

/** GET /api/reservation-items/:id/damage-invoice : détail de la retenue de caution et du complément éventuellement facturé. */
export const GET = route<{ id: string }>(async ({ params }) => {
  const actor = await requireActor();
  const item = await db.reservationItem.findUnique({ where: { id: params.id }, include: { deposit: true, returnReport: true, extraCharges: true, reservation: { select: { reference: true, clientId: true } } } });
  if (!item || !item.returnReport) throw notFound("Constat de retour");
  const allowed = (actor.accountType === "CLIENT" && item.reservation.clientId === actor.userId) || (actor.accountType === "LENDER" && item.lenderId === actor.lenderId && can(actor, "DEPOSIT_VIEW")) || (actor.accountType === "ADMIN" && can(actor, "ADMIN_DEPOSITS"));
  if (!allowed) throw forbidden();
  const r = item.returnReport;
  return ok({
    reservation: item.reservation.reference,
    product: item.productName,
    rentedQuantity: r.rentedQuantity,
    returnedQuantity: r.returnedQuantity,
    damagedQuantity: r.damagedQuantity,
    lostQuantity: r.lostQuantity,
    refundPrice: r.refundPrice,
    lostAmount: r.lostQuantity * r.refundPrice,
    damageAmount: r.damageAmount,
    deposit: item.deposit ? { amount: item.deposit.amount, withheld: item.deposit.withheldAmount, released: item.deposit.releasedAmount, status: item.deposit.status } : null,
    extraCharges: item.extraCharges,
    status: r.status,
  });
});
