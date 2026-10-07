import type { Prisma, ReservationStatus } from "@prisma/client";
import { db, transaction, lockReservation, type Tx } from "@/lib/db";
import { AppError, forbidden, notFound } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { reference } from "@/lib/ids";
import { getSettings } from "@/lib/settings";
import { assertTransition, aggregateStatus } from "@/lib/state-machine";
import { can, type Actor } from "@/lib/auth/actor";
import { assertAvailable, validateRentalPeriod } from "./availability";
import { computeTotals, depositFloorFrom, depositPercentFrom, effectivePaymentMode, priceLine, type LenderDeliveryTerms } from "./pricing";
import { notifyLender, notifyUsers } from "./notifications";
import { assertCashSettled, syncCashSettlement } from "./cash";
import { commissionRateFor } from "./plans";

const RESERVATION_ITEM_INCLUDE = {
  product: { select: { id: true, slug: true, name: true, photos: { orderBy: { position: "asc" as const }, take: 1 } } },
  lender: { select: { id: true, slug: true, companyName: true, phone: true, address: true } },
  deposit: true,
  returnReport: { include: { photos: true } },
  extraCharges: true,
  review: true,
} satisfies Prisma.ReservationItemInclude;

/**
 * Crée une réservation (statut HOLD) à partir d'un HOLD actif. Les prix, commissions, cautions et frais de livraison
 * sont recalculés ici, côté serveur, et figés dans les lignes. Idempotent : un HOLD ne produit qu'une réservation.
 */
export async function createReservationFromHold(userId: string, holdId: string, actorId: string = userId) {
  const settings = await getSettings();
  return transaction(async (tx) => {
    const hold = await tx.hold.findFirst({ where: { id: holdId, userId }, include: { items: { include: { product: { include: { lender: true } } } } } });
    if (!hold) throw notFound("Blocage de stock");

    const existing = await tx.reservation.findFirst({ where: { holdId }, include: { items: true } });
    if (existing) {
      if (["HOLD", "PENDING_PAYMENT", "PAID", "CONFIRMED"].includes(existing.status)) return existing;
      throw new AppError("CONFLICT", "Une réservation existe déjà pour ce blocage de stock.");
    }
    const now = new Date();
    if (hold.status !== "ACTIVE" || hold.expiresAt <= now) throw new AppError("HOLD_EXPIRED", "Le blocage de stock a expiré. Relancez le paiement depuis votre panier.");

    for (const i of hold.items) {
      if (i.product.status !== "PUBLISHED" || i.product.deletedAt || i.product.lender.status !== "APPROVED") {
        throw new AppError("VALIDATION_ERROR", `${i.product.name} n'est plus disponible à la location.`);
      }
      validateRentalPeriod(settings, i.product, { quantity: i.quantity, start: i.startDate, end: i.endDate }, hold.createdAt);
    }
    await assertAvailable(tx, hold.items.map((i) => ({ productId: i.productId, quantity: i.quantity, start: i.startDate, end: i.endDate })), { excludeHoldId: hold.id });

    const terms = new Map<string, LenderDeliveryTerms>();
    for (const i of hold.items) {
      const l = i.product.lender;
      terms.set(l.id, { lenderId: l.id, cityId: l.cityId, offersDelivery: l.offersDelivery, feeLocal: l.deliveryFeeLocal, feeRemote: l.deliveryFeeRemote, commissionRateBps: commissionRateFor(l, settings), paymentMode: effectivePaymentMode(l, settings) });
    }
    if (hold.fulfillmentType === "DELIVERY") {
      for (const t of terms.values()) {
        if (!t.offersDelivery) {
          const name = hold.items.find((i) => i.product.lenderId === t.lenderId)!.product.lender.companyName;
          throw new AppError("VALIDATION_ERROR", `${name} ne propose pas la livraison. Choisissez le retrait pour cette commande.`);
        }
      }
    }

    const priced = hold.items.map((i) =>
      priceLine({ productId: i.productId, lenderId: i.product.lenderId, quantity: i.quantity, start: i.startDate, end: i.endDate, unitPrice: i.product.unitPrice, depositAmount: i.product.depositAmount, refundPrice: i.product.refundPrice, commissionRateBps: terms.get(i.product.lenderId)!.commissionRateBps, paymentMode: terms.get(i.product.lenderId)!.paymentMode, minCashDeposit: settings["cash.min_deposit"], depositPercent: depositPercentFrom(settings), depositFloorPercent: depositFloorFrom(settings) }),
    );
    const totals = computeTotals(priced, terms, hold.fulfillmentType, hold.deliveryCityId, settings["commission.on_delivery"]);

    let ref = reference("LC");
    while (await tx.reservation.findUnique({ where: { reference: ref } })) ref = reference("LC");

    const reservation = await tx.reservation.create({
      data: {
        reference: ref,
        clientId: userId,
        status: "HOLD",
        fulfillmentType: hold.fulfillmentType,
        deliveryAddress: hold.deliveryAddress,
        deliveryCityId: hold.deliveryCityId,
        deliveryZone: hold.deliveryZone,
        contactPhone: hold.contactPhone,
        subtotal: totals.subtotal,
        deliveryFee: totals.deliveryFee,
        depositTotal: totals.depositTotal,
        commissionTotal: totals.commissionTotal,
        cashTotal: totals.cashTotal,
        total: totals.total,
        holdId: hold.id,
        items: {
          create: priced.map((l, idx) => ({
            productId: l.productId,
            lenderId: l.lenderId,
            productName: hold.items[idx].product.name,
            quantity: l.quantity,
            startDate: l.start,
            endDate: l.end,
            days: l.days,
            unitPrice: l.unitPrice,
            subtotal: l.subtotal,
            commissionRateBps: l.commissionRateBps,
            commission: l.commission,
            paymentMode: l.paymentMode,
            cashDue: l.cashDue,
            depositAmount: l.deposit,
            depositPercent: l.depositPercent ?? null,
            depositFloorPercent: l.depositFloorPercent ?? null,
            refundPrice: l.refundPrice,
            allowsExtraBilling: hold.items[idx].product.allowsExtraBilling,
            status: "HOLD",
            deposit: { create: { amount: l.deposit } },
          })),
        },
      },
      include: { items: true },
    });
    if (hold.fulfillmentType === "DELIVERY") {
      for (const b of totals.byLender) {
        const mine = priced.filter((l) => l.lenderId === b.lenderId);
        await tx.delivery.create({
          data: {
            reservationId: reservation.id,
            lenderId: b.lenderId,
            type: "DELIVERY",
            address: hold.deliveryAddress,
            cityId: hold.deliveryCityId,
            zone: hold.deliveryZone,
            fee: b.delivery,
            scheduledDate: new Date(Math.min(...mine.map((l) => l.start.getTime()))),
          },
        });
      }
    }
    for (const b of totals.byLender) {
      if (b.paymentMode === "DEPOSIT_CASH") await syncCashSettlement(tx, reservation.id, b.lenderId, { deliveryDue: b.cashDelivery });
    }
    await tx.reservationStatusHistory.create({ data: { reservationId: reservation.id, toStatus: "HOLD", actorId, note: "Réservation créée depuis le blocage de stock" } });
    await tx.reservationVersion.create({ data: { reservationId: reservation.id, version: 1, snapshot: snapshotOf(reservation) as Prisma.InputJsonValue, total: reservation.total, deposit: reservation.depositTotal, commission: reservation.commissionTotal, createdById: actorId } });
    await audit(tx, { userId: actorId, action: "reservation.create", entity: "Reservation", entityId: reservation.id, newValue: { reference: ref, total: reservation.total } });
    return reservation;
  });
}

export function snapshotOf(r: { reference: string; total: number; depositTotal: number; commissionTotal: number; subtotal: number; deliveryFee: number; fulfillmentType: string; items: { id: string; productId: string; productName: string; quantity: number; startDate: Date; endDate: Date; unitPrice: number; subtotal: number; commission: number; depositAmount: number; status: string }[] }) {
  return {
    reference: r.reference,
    total: r.total,
    depositTotal: r.depositTotal,
    commissionTotal: r.commissionTotal,
    subtotal: r.subtotal,
    deliveryFee: r.deliveryFee,
    fulfillmentType: r.fulfillmentType,
    items: r.items.map((i) => ({ id: i.id, productId: i.productId, productName: i.productName, quantity: i.quantity, startDate: i.startDate.toISOString().slice(0, 10), endDate: i.endDate.toISOString().slice(0, 10), unitPrice: i.unitPrice, subtotal: i.subtotal, commission: i.commission, depositAmount: i.depositAmount, status: i.status })),
  };
}

/** Recalcule le statut global à partir des lignes et l'historise s'il change. */
export async function recomputeStatus(tx: Tx, reservationId: string, actorId?: string | null): Promise<ReservationStatus> {
  const reservation = await tx.reservation.findUniqueOrThrow({ where: { id: reservationId }, include: { items: { select: { status: true } } } });
  const next = aggregateStatus(reservation.items.map((i) => i.status));
  if (next !== reservation.status) {
    await tx.reservation.update({ where: { id: reservationId }, data: { status: next } });
    await tx.reservationStatusHistory.create({ data: { reservationId, fromStatus: reservation.status, toStatus: next, actorId: actorId ?? null } });
  }
  return next;
}

export type TransitionOptions = { actorId?: string | null; note?: string; itemIds?: string[]; lenderId?: string; onlyFrom?: ReservationStatus[] };

/**
 * Change le statut de lignes de réservation en validant chaque transition, en historisant et en recalculant le statut global.
 * Les lignes dont le statut ne figure pas dans `onlyFrom` sont ignorées (utile pour les actions de masse).
 */
export async function transitionItems(tx: Tx, reservationId: string, to: ReservationStatus, opts: TransitionOptions = {}) {
  const items = await tx.reservationItem.findMany({
    where: { reservationId, ...(opts.itemIds ? { id: { in: opts.itemIds } } : {}), ...(opts.lenderId ? { lenderId: opts.lenderId } : {}) },
  });
  const targets = opts.onlyFrom ? items.filter((i) => opts.onlyFrom!.includes(i.status)) : items;
  for (const item of targets) {
    assertTransition(item.status, to);
    await tx.reservationItem.update({
      where: { id: item.id },
      data: { status: to, ...(to === "CANCELLED" || to === "REFUNDED" ? { cancelledAt: item.cancelledAt ?? new Date() } : {}) },
    });
    await tx.reservationStatusHistory.create({ data: { reservationId, itemId: item.id, fromStatus: item.status, toStatus: to, actorId: opts.actorId ?? null, note: opts.note } });
  }
  await recomputeStatus(tx, reservationId, opts.actorId);
  return targets;
}

// ---------------------------------------------------------------------------
// Lecture et contrôle d'accès
// ---------------------------------------------------------------------------

export type Scope = { kind: "client" } | { kind: "lender"; lenderId: string } | { kind: "admin" };

/** Qui peut voir cette réservation ? Le client propriétaire, les loueurs concernés (leurs lignes uniquement), l'administration. */
export async function resolveScope(actor: Actor, reservationId: string): Promise<Scope> {
  const base = await db.reservation.findUnique({ where: { id: reservationId }, select: { clientId: true } });
  if (!base) throw notFound("Réservation");
  if (actor.accountType === "CLIENT") {
    if (base.clientId !== actor.userId) throw forbidden();
    return { kind: "client" };
  }
  if (actor.accountType === "ADMIN") {
    if (!can(actor, "ADMIN_RESERVATIONS")) throw forbidden();
    return { kind: "admin" };
  }
  if (!actor.lenderId || !can(actor, "ORDER_VIEW")) throw forbidden();
  const has = await db.reservationItem.count({ where: { reservationId, lenderId: actor.lenderId } });
  if (has === 0) throw forbidden();
  return { kind: "lender", lenderId: actor.lenderId };
}

export async function getReservationDetail(actor: Actor, reservationId: string) {
  const scope = await resolveScope(actor, reservationId);
  const itemWhere = scope.kind === "lender" ? { lenderId: scope.lenderId } : {};
  const reservation = await db.reservation.findUniqueOrThrow({
    where: { id: reservationId },
    include: {
      client: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
      items: { where: itemWhere, include: RESERVATION_ITEM_INCLUDE, orderBy: { createdAt: "asc" } },
      payments: { orderBy: { createdAt: "desc" }, include: scope.kind === "lender" ? { allocations: { where: { lenderId: scope.lenderId } } } : { allocations: true } },
      deliveries: { where: scope.kind === "lender" ? { lenderId: scope.lenderId } : {}, include: { proofs: true, lender: { select: { companyName: true } } } },
      disputes: { where: scope.kind === "lender" ? { lenderId: scope.lenderId } : {}, orderBy: { createdAt: "desc" } },
      refunds: scope.kind === "lender" ? false : { orderBy: { createdAt: "desc" } },
      modifications: { where: scope.kind === "lender" ? { lenderId: scope.lenderId } : {}, orderBy: { requestedAt: "desc" }, include: { lines: true } },
      history: { where: scope.kind === "lender" ? { OR: [{ itemId: null }, { item: { lenderId: scope.lenderId } }] } : {}, orderBy: { createdAt: "asc" } },
      // Le code de remise n'est jamais transmis au loueur : c'est la preuve que le client a payé.
      cashSettlements: {
        where: scope.kind === "lender" ? { lenderId: scope.lenderId } : {},
        select: { id: true, lenderId: true, amountDue: true, deliveryDue: true, status: true, failedAttempts: true, confirmedAt: true, reportedAt: true, note: true, code: scope.kind !== "lender", lender: { select: { companyName: true } } },
      },
    },
  });
  return { reservation, scope };
}

export type ReservationDetail = Awaited<ReturnType<typeof getReservationDetail>>["reservation"];

export async function listClientReservations(userId: string, opts: { status?: ReservationStatus[]; page?: number; pageSize?: number } = {}) {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = opts.pageSize ?? 10;
  const where: Prisma.ReservationWhereInput = { clientId: userId, status: opts.status?.length ? { in: opts.status } : { notIn: ["HOLD", "DRAFT"] } };
  const [total, rows] = await Promise.all([
    db.reservation.count({ where }),
    db.reservation.findMany({
      where,
      include: { items: { include: { product: { select: { slug: true, name: true, photos: { orderBy: { position: "asc" }, take: 1 } } }, lender: { select: { companyName: true } }, deposit: true } }, payments: { select: { status: true, kind: true, provider: true }, orderBy: { createdAt: "desc" }, take: 1 } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  return { rows, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function listLenderReservations(lenderId: string, opts: { status?: ReservationStatus[]; page?: number; pageSize?: number; q?: string } = {}) {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = opts.pageSize ?? 15;
  const where: Prisma.ReservationItemWhereInput = {
    lenderId,
    status: opts.status?.length ? { in: opts.status } : { notIn: ["HOLD", "DRAFT", "PENDING_PAYMENT"] },
    ...(opts.q ? { OR: [{ reservation: { reference: { contains: opts.q, mode: "insensitive" } } }, { productName: { contains: opts.q, mode: "insensitive" } }, { reservation: { client: { lastName: { contains: opts.q, mode: "insensitive" } } } }] } : {}),
  };
  const [total, rows] = await Promise.all([
    db.reservationItem.count({ where }),
    db.reservationItem.findMany({
      where,
      include: { reservation: { select: { id: true, reference: true, fulfillmentType: true, client: { select: { firstName: true, lastName: true } } } }, deposit: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  return { rows, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

// ---------------------------------------------------------------------------
// Actions du loueur et de l'administration sur le statut
// ---------------------------------------------------------------------------

type LenderTarget = "CONFIRMED" | "READY" | "IN_USE";

const LENDER_RULES: Record<LenderTarget, { permission: string; from: ReservationStatus[]; label: string }> = {
  CONFIRMED: { permission: "ORDER_VALIDATE", from: ["PAID"], label: "confirmée" },
  READY: { permission: "ORDER_PREPARE", from: ["CONFIRMED"], label: "prête" },
  IN_USE: { permission: "ORDER_STATUS_UPDATE", from: ["READY", "DELIVERED"], label: "remise au client" },
};

/** Le loueur fait avancer ses propres lignes : valider, préparer, remettre au client (retrait ou après livraison). */
export async function lenderAdvance(actor: Actor & { lenderId: string }, reservationId: string, to: LenderTarget, itemIds?: string[]) {
  const rule = LENDER_RULES[to];
  if (!rule) throw new AppError("VALIDATION_ERROR", "Statut non autorisé pour un loueur.");
  if (!can(actor, rule.permission)) throw forbidden("Votre rôle ne permet pas cette action.");
  await resolveScope(actor, reservationId);
  if (actor.lenderStatus !== "APPROVED") throw forbidden("Votre entreprise doit être validée pour traiter des commandes.");

  return transaction(async (tx) => {
    await lockReservation(tx, reservationId);
    const reservation = await tx.reservation.findUniqueOrThrow({ where: { id: reservationId } });
    if (to === "IN_USE") await assertCashSettled(tx, reservationId, actor.lenderId);
    if (to === "IN_USE" && reservation.fulfillmentType === "DELIVERY") {
      const items = await tx.reservationItem.findMany({ where: { reservationId, lenderId: actor.lenderId, ...(itemIds ? { id: { in: itemIds } } : {}) } });
      if (items.some((i) => i.status === "READY")) throw new AppError("INVALID_TRANSITION", "Cette commande est en livraison : utilisez le suivi de livraison.");
    }
    const moved = await transitionItems(tx, reservationId, to, { actorId: actor.userId, lenderId: actor.lenderId, itemIds, onlyFrom: rule.from });
    if (moved.length === 0) throw new AppError("INVALID_TRANSITION", "Aucune ligne ne peut passer à ce statut.");
    await audit(tx, { userId: actor.userId, lenderId: actor.lenderId, action: `reservation.${to.toLowerCase()}`, entity: "Reservation", entityId: reservationId, newValue: { items: moved.map((m) => m.id) }, meta: actor.meta });
    await notifyUsers(tx, [reservation.clientId], {
      type: "reservation.updated",
      title: `Réservation ${reservation.reference} ${rule.label}`,
      body: `${moved.map((m) => m.productName).join(", ")} : ${rule.label}.`,
      link: `/mes-reservations/${reservationId}`,
    });
    return moved;
  });
}

/** Passage manuel par l'administration (corrections, support). Toujours audité. */
export async function adminSetItemStatus(actor: Actor, reservationId: string, to: ReservationStatus, itemIds: string[] | undefined, note: string) {
  if (!can(actor, "ADMIN_RESERVATIONS")) throw forbidden();
  return transaction(async (tx) => {
    await lockReservation(tx, reservationId);
    const moved = await transitionItems(tx, reservationId, to, { actorId: actor.userId, itemIds, note });
    await audit(tx, { userId: actor.userId, action: "reservation.admin_status", entity: "Reservation", entityId: reservationId, newValue: { to, note, items: moved.map((m) => m.id) }, meta: actor.meta });
    return moved;
  });
}

export async function notifyLendersOfNewReservation(tx: Tx, reservationId: string) {
  const r = await tx.reservation.findUniqueOrThrow({ where: { id: reservationId }, include: { items: true } });
  const lenderIds = [...new Set(r.items.map((i) => i.lenderId))];
  for (const lenderId of lenderIds) {
    const mine = r.items.filter((i) => i.lenderId === lenderId);
    await notifyLender(tx, lenderId, { type: "reservation.new", title: `Nouvelle réservation ${r.reference}`, body: `${mine.map((i) => `${i.quantity} x ${i.productName}`).join(", ")}`, link: `/loueur/reservations/${reservationId}` }, "ORDER_VIEW");
  }
}
