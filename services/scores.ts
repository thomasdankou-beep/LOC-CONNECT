import { db } from "@/lib/db";
import { holdNonConversionRate } from "./holds";

/** SCORE_CLIENT : symétrique de SCORE_LOUEUR. Un taux de HOLD non convertis élevé réduit la durée de HOLD accordée. */
export async function computeClientScore(clientId: string) {
  const [hold, reservations, cancelled, disputes] = await Promise.all([
    holdNonConversionRate(clientId),
    db.reservation.count({ where: { clientId, status: { notIn: ["HOLD", "DRAFT"] } } }),
    db.reservation.count({ where: { clientId, status: { in: ["CANCELLED", "REFUNDED"] } } }),
    db.dispute.count({ where: { openedById: clientId } }),
  ]);
  const cancellationRate = reservations ? cancelled / reservations : 0;
  const disputeRate = reservations ? disputes / reservations : 0;
  const score = Math.max(0, Math.round(100 - hold.rate * 50 - cancellationRate * 30 - disputeRate * 20));
  return db.clientScore.upsert({
    where: { clientId },
    update: { holdNonConversionRate: hold.rate, cancellationRate, disputeRate, score, computedAt: new Date() },
    create: { clientId, holdNonConversionRate: hold.rate, cancellationRate, disputeRate, score },
  });
}

export async function computeLenderScore(lenderId: string) {
  const [lender, items, cancelled, disputes, modifications, answered] = await Promise.all([
    db.lender.findUniqueOrThrow({ where: { id: lenderId }, select: { ratingAvg: true } }),
    db.reservationItem.count({ where: { lenderId, status: { notIn: ["HOLD", "DRAFT", "PENDING_PAYMENT"] } } }),
    db.reservationItem.count({ where: { lenderId, status: { in: ["CANCELLED", "REFUNDED"] } } }),
    db.dispute.count({ where: { lenderId } }),
    db.modificationRequest.count({ where: { lenderId } }),
    db.modificationRequest.count({ where: { lenderId, escalatedAt: null } }),
  ]);
  const cancellationRate = items ? cancelled / items : 0;
  const disputeRate = items ? disputes / items : 0;
  const responseRate = modifications ? answered / modifications : 1;
  const score = Math.max(0, Math.round(lender.ratingAvg * 12 + (1 - cancellationRate) * 15 + (1 - disputeRate) * 15 + responseRate * 10));
  return db.lenderScore.upsert({
    where: { lenderId },
    update: { rating: lender.ratingAvg, cancellationRate, disputeRate, responseRate, score, computedAt: new Date() },
    create: { lenderId, rating: lender.ratingAvg, cancellationRate, disputeRate, responseRate, score },
  });
}
