import type { BalanceEntryKind, Payment, Prisma, RefundKind, TransactionDirection, TransactionType } from "@prisma/client";
import type { Tx } from "@/lib/db";
import { reference } from "@/lib/ids";
import { addHours } from "@/lib/dates";
import type { Settings } from "@/lib/settings";

/** Journal financier immuable : les lignes ne sont jamais modifiées ni supprimées. */
export async function recordTransaction(
  tx: Tx,
  t: {
    type: TransactionType;
    direction: TransactionDirection;
    amount: number;
    paymentId?: string | null;
    reservationId?: string | null;
    itemId?: string | null;
    lenderId?: string | null;
    refundId?: string | null;
    payoutId?: string | null;
    createdById?: string | null;
    metadata?: Prisma.InputJsonValue;
  },
) {
  if (t.amount <= 0) return null;
  return tx.financialTransaction.create({
    data: { reference: reference("TX", 10), type: t.type, direction: t.direction, amount: t.amount, paymentId: t.paymentId, reservationId: t.reservationId, itemId: t.itemId, lenderId: t.lenderId, refundId: t.refundId, payoutId: t.payoutId, createdById: t.createdById, metadata: t.metadata },
  });
}

/** Un montant devient versable après la fin de location + délai de gel (par défaut 72 h). */
export const freezeUntil = (endDate: Date, settings: Pick<Settings, "payout.freeze_hours">): Date => addHours(endDate, settings["payout.freeze_hours"]);

export async function addBalanceEntry(
  tx: Tx,
  e: { lenderId: string; kind: BalanceEntryKind; amount: number; availableAt: Date; reservationId?: string | null; itemId?: string | null; blocked?: boolean; note?: string },
) {
  if (e.amount === 0) return null;
  return tx.balanceEntry.create({ data: { lenderId: e.lenderId, kind: e.kind, amount: e.amount, availableAt: e.availableAt, reservationId: e.reservationId, itemId: e.itemId, blocked: e.blocked ?? false, note: e.note } });
}

export type LenderImpact = { lenderId: string; amount: number; itemId?: string | null; note?: string };

export type ExecuteRefundInput = {
  payment: Pick<Payment, "id" | "amount" | "reservationId">;
  kind: RefundKind;
  amount: number;
  reason: string;
  requestedById?: string | null;
  /** Part du remboursement supportée par chaque loueur (déduite de son solde, recouvrée s'il a déjà été versé). */
  impacts?: LenderImpact[];
  detail?: Prisma.InputJsonValue;
};

/**
 * Exécute un remboursement (simulé : exécution immédiate). Écrit le remboursement, le journal financier,
 * l'état du paiement et, pour chaque loueur impacté, une déduction de solde et une ligne de recouvrement :
 *  - loueur pas encore versé : la déduction compense simplement sa part (NON_NECESSAIRE) ;
 *  - loueur déjà versé : montant à recouvrer sur son prochain versement ou réclamé manuellement (A_RECUPERER).
 */
export async function executeRefund(tx: Tx, input: ExecuteRefundInput) {
  const { payment } = input;
  const alreadyRefunded = await tx.refund.aggregate({ where: { paymentId: payment.id, status: "COMPLETED" }, _sum: { amount: true } });
  const refunded = alreadyRefunded._sum.amount ?? 0;
  const remaining = payment.amount - refunded;
  const amount = Math.min(input.amount, remaining);
  if (amount <= 0) return null;

  const refund = await tx.refund.create({
    data: {
      reference: reference("RF", 8),
      paymentId: payment.id,
      reservationId: payment.reservationId,
      kind: input.kind,
      type: amount >= remaining && refunded === 0 ? "TOTAL" : "PARTIAL",
      amount,
      reason: input.reason,
      status: "COMPLETED",
      providerRef: `SIM-RF-${reference("X", 6)}`,
      requestedById: input.requestedById ?? null,
      detail: input.detail,
      executedAt: new Date(),
    },
  });

  // Restituer une caution n'est pas un remboursement du paiement : le statut du paiement ne change pas.
  if (input.kind !== "DEPOSIT_RELEASE") {
    await tx.payment.update({ where: { id: payment.id }, data: { status: refunded + amount >= payment.amount ? "REFUNDED" : "PARTIALLY_REFUNDED" } });
  }
  await recordTransaction(tx, { type: input.kind === "DEPOSIT_RELEASE" ? "DEPOSIT_RELEASED" : "REFUND", direction: "OUT", amount, paymentId: payment.id, reservationId: payment.reservationId, refundId: refund.id, createdById: input.requestedById, metadata: { kind: input.kind, reason: input.reason } });

  for (const impact of input.impacts ?? []) {
    if (impact.amount <= 0) continue;
    // Le loueur a-t-il déjà été versé pour cette vente ? Sans ligne précise, on regarde l'ensemble de la réservation.
    const sale = impact.itemId
      ? await tx.balanceEntry.findFirst({ where: { itemId: impact.itemId, lenderId: impact.lenderId, kind: "SALE" } })
      : await tx.balanceEntry.findFirst({ where: { reservationId: payment.reservationId, lenderId: impact.lenderId, kind: "SALE", payoutId: { not: null } } });
    const alreadyPaid = Boolean(sale?.payoutId);
    const entry = await addBalanceEntry(tx, {
      lenderId: impact.lenderId,
      kind: "REFUND_DEDUCTION",
      amount: -impact.amount,
      availableAt: new Date(),
      reservationId: payment.reservationId,
      itemId: impact.itemId,
      note: impact.note ?? `Remboursement ${refund.reference}`,
    });
    await tx.lenderReimbursement.create({
      data: { refundId: refund.id, lenderId: impact.lenderId, impactedAmount: impact.amount, status: alreadyPaid ? "TO_RECOVER" : "NOT_NEEDED", balanceEntryId: entry?.id, note: impact.note },
    });
  }
  return refund;
}
