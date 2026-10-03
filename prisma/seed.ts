import "dotenv/config";
import { randomUUID } from "node:crypto";
import { db } from "../lib/db";
import { env } from "../lib/env";
import { hashPassword } from "../lib/auth/password";
import { loadActor, type Actor } from "../lib/auth/actor";
import { addDays, parseDate, toISODate, todayUTC } from "../lib/dates";
import { slugify } from "../lib/ids";
import { seedSystemData } from "./system";
import { CATEGORIES, CITIES, CLIENTS, LENDERS, REVIEW_COMMENTS } from "./seed-data";
import { addToCart } from "../services/cart";
import { availabilityForProduct, minAvailable } from "../services/availability";
import { createHold, expireHolds } from "../services/holds";
import { createReservationFromHold, lenderAdvance } from "../services/reservations";
import { initiatePayment, simulatePayment } from "../services/payments";
import { acknowledgeReport, contestReport, createReturnReport } from "../services/returns";
import { cancelReservation } from "../services/refunds";
import { decideDispute, openDispute } from "../services/disputes";
import { createReview, replyToReview } from "../services/reviews";
import { escalateAndExpireModifications, requestModification } from "../services/modifications";
import { runPayout } from "../services/payouts";
import { runMaintenance } from "../services/maintenance";
import { updateDelivery } from "../services/deliveries";
import { computeClientScore, computeLenderScore } from "../services/scores";
import { createPromotion } from "../services/admin";

const PASSWORD = env().SEED_DEMO_PASSWORD;
const EMAIL_DOMAIN = "demo-locconnect.ci";
const photo = (seed: string, n: number) => `https://picsum.photos/seed/${seed}-${n}/1200/900`;
const pad = (n: number) => String(n).padStart(2, "0");

const TABLES = [
  "ModificationLine", "ModificationRequest", "ReservationVersion", "BalanceEntry", "Payout", "LenderReimbursement", "FinancialTransaction", "Refund", "PaymentAllocation",
  "ExtraCharge", "ReturnPhoto", "ReturnReport", "Deposit", "DeliveryProof", "Delivery", "Attachment", "DisputeMessage", "Dispute", "Review", "Payment", "WebhookEvent",
  "ReservationStatusHistory", "ReservationItem", "Reservation", "HoldItem", "Hold", "CartItem", "Cart", "Notification", "AuditLog", "Favorite", "Promotion", "Subscription",
  "AvailabilityBlock", "StockMovement", "ProductPriceHistory", "ProductPhoto", "Product", "LenderUnavailability", "LenderScore", "ClientScore", "ValidationAction",
  "LenderMember", "Lender", "UserRole", "RolePermission", "Role", "Permission", "Session", "PasswordResetToken", "User", "Category", "City", "CancellationRule", "CancellationPolicy", "Setting",
];

type Account = { id: string; actor: Actor };
const rnd = (() => {
  let s = 20260601;
  return () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
})();
const pick = <T,>(arr: T[]) => arr[Math.floor(rnd() * arr.length)];

async function actorOf(userId: string): Promise<Actor> {
  const a = await loadActor(userId);
  if (!a) throw new Error(`Acteur introuvable: ${userId}`);
  return a;
}

/** Recule toute la chronologie d'une réservation de `days` jours (données historiques réalistes). Dates seules : montants inchangés. */
async function shiftBack(reservationId: string, days: number) {
  if (days <= 0) return;
  const rid = reservationId.replace(/[^a-zA-Z0-9]/g, "");
  const d = Math.trunc(days);
  const ts = (col: string) => `"${col}" = "${col}" - interval '${d} days'`;
  const dt = (col: string) => `"${col}" = ("${col}" - interval '${d} days')::date`;
  const run = (sql: string) => db.$executeRawUnsafe(sql);
  await run(`UPDATE "ReservationItem" SET ${dt("startDate")}, ${dt("endDate")}, ${ts("createdAt")}, ${ts("updatedAt")} WHERE "reservationId" = '${rid}'`);
  await run(`UPDATE "Reservation" SET ${ts("createdAt")}, ${ts("updatedAt")} WHERE id = '${rid}'`);
  await run(`UPDATE "ReservationStatusHistory" SET ${ts("createdAt")} WHERE "reservationId" = '${rid}'`);
  await run(`UPDATE "ReservationVersion" SET ${ts("createdAt")} WHERE "reservationId" = '${rid}'`);
  await run(`UPDATE "Payment" SET ${ts("createdAt")}, ${ts("updatedAt")}, "paidAt" = "paidAt" - interval '${d} days' WHERE "reservationId" = '${rid}'`);
  await run(`UPDATE "PaymentAllocation" SET ${ts("createdAt")} WHERE "reservationId" = '${rid}'`);
  await run(`UPDATE "FinancialTransaction" SET ${ts("createdAt")} WHERE "reservationId" = '${rid}'`);
  await run(`UPDATE "BalanceEntry" SET ${ts("createdAt")}, ${ts("availableAt")} WHERE "reservationId" = '${rid}'`);
  await run(`UPDATE "Refund" SET ${ts("createdAt")}, "executedAt" = "executedAt" - interval '${d} days' WHERE "reservationId" = '${rid}'`);
  await run(`UPDATE "Delivery" SET "scheduledDate" = ("scheduledDate" - interval '${d} days')::date, ${ts("createdAt")}, "deliveredAt" = "deliveredAt" - interval '${d} days' WHERE "reservationId" = '${rid}'`);
  await run(`UPDATE "Deposit" SET ${ts("createdAt")}, "heldAt" = "heldAt" - interval '${d} days', "settledAt" = "settledAt" - interval '${d} days', "releaseDueDate" = "releaseDueDate" - interval '${d} days' WHERE "itemId" IN (SELECT id FROM "ReservationItem" WHERE "reservationId" = '${rid}')`);
  await run(`UPDATE "ReturnReport" SET ${ts("createdAt")}, "settledAt" = "settledAt" - interval '${d} days', "contestDeadline" = "contestDeadline" - interval '${d} days' WHERE "itemId" IN (SELECT id FROM "ReservationItem" WHERE "reservationId" = '${rid}')`);
  await run(`UPDATE "Hold" SET ${ts("createdAt")}, "expiresAt" = "expiresAt" - interval '${d} days' WHERE id IN (SELECT "holdId" FROM "Reservation" WHERE id = '${rid}')`);
  await run(`UPDATE "Notification" SET ${ts("createdAt")}, "sentAt" = "sentAt" - interval '${d} days' WHERE link LIKE '%${rid}%'`);
}

async function main() {
  const force = process.argv.includes("--force");
  if ((await db.user.count()) > 0 && !force) {
    console.log("La base contient déjà des données. Relancez avec --force pour la réinitialiser (npm run db:seed -- --force).");
    return;
  }
  console.log("Réinitialisation de la base…");
  await db.$executeRawUnsafe(`TRUNCATE ${TABLES.map((t) => `"${t}"`).join(", ")} RESTART IDENTITY CASCADE`);
  await seedSystemData(db);
  const passwordHash = await hashPassword(PASSWORD);

  // --- Villes et catégories ------------------------------------------------
  const cityIds = new Map<string, string>();
  for (const c of CITIES) {
    const city = await db.city.create({ data: { slug: slugify(c.name), name: c.name, region: c.region, imageUrl: photo(`ville-${slugify(c.name)}`, 1) } });
    cityIds.set(c.name, city.id);
  }
  const categoryIds = new Map<string, string>();
  let position = 0;
  for (const c of CATEGORIES) {
    const root = await db.category.create({ data: { slug: slugify(c.name), name: c.name, icon: c.icon, description: c.description, position: position++, imageUrl: photo(`categorie-${slugify(c.name)}`, 1) } });
    categoryIds.set(c.name, root.id);
    let childPos = 0;
    for (const child of c.children) {
      const sub = await db.category.create({ data: { slug: slugify(child), name: child, icon: c.icon, parentId: root.id, position: childPos++ } });
      categoryIds.set(child, sub.id);
    }
  }

  // --- Administrateurs -----------------------------------------------------
  const adminDefs: [string, string, string, string][] = [
    ["admin", "Direction", "LOC'CONNECT", "SUPER_ADMIN"],
    ["support", "Julie", "Gbané", "ADMIN_SUPPORT"],
    ["finance", "Patrick", "Zadi", "ADMIN_FINANCE"],
    ["moderation", "Sandrine", "Ahoua", "ADMIN_MODERATION"],
    ["stock", "Roland", "Bakayoko", "ADMIN_STOCK"],
  ];
  const admins = new Map<string, Account>();
  for (const [key, first, last, roleCode] of adminDefs) {
    const user = await db.user.create({ data: { email: `${key}@${EMAIL_DOMAIN}`, passwordHash, firstName: first, lastName: last, accountType: "ADMIN", emailVerifiedAt: new Date(), lastLoginAt: new Date() } });
    const role = await db.role.findUniqueOrThrow({ where: { key: `SYSTEM:${roleCode}` } });
    await db.userRole.create({ data: { userId: user.id, roleId: role.id } });
    admins.set(key, { id: user.id, actor: await actorOf(user.id) });
  }
  const admin = admins.get("admin")!;
  const finance = admins.get("finance")!;

  // --- Clients -------------------------------------------------------------
  const clients: Account[] = [];
  for (const [i, [first, last, city]] of CLIENTS.entries()) {
    const user = await db.user.create({
      data: { email: `client${pad(i + 1)}@${EMAIL_DOMAIN}`, passwordHash, firstName: first, lastName: last, phone: `+225 07 ${pad(10 + i)} ${pad(20 + i)} ${pad(30 + i)}`, accountType: "CLIENT", emailVerifiedAt: new Date(), cityId: cityIds.get(city), deliveryAddress: `Rue ${i + 12}, ${city}`, lastLoginAt: new Date() },
    });
    clients.push({ id: user.id, actor: await actorOf(user.id) });
  }

  // --- Loueurs, produits, abonnements --------------------------------------
  type LenderAcc = Account & { lenderId: string; company: string; productIds: string[] };
  const lenders: LenderAcc[] = [];
  for (const [i, l] of LENDERS.entries()) {
    const user = await db.user.create({
      data: { email: `loueur${pad(i + 1)}@${EMAIL_DOMAIN}`, passwordHash, firstName: l.owner[0], lastName: l.owner[1], phone: `+225 05 ${pad(40 + i)} ${pad(50 + i)} ${pad(60 + i)}`, accountType: "LENDER", emailVerifiedAt: new Date(), cityId: cityIds.get(l.city), lastLoginAt: new Date() },
    });
    const approved = (l.status ?? "APPROVED") === "APPROVED";
    const lender = await db.lender.create({
      data: {
        ownerId: user.id,
        slug: slugify(l.company),
        companyName: l.company,
        rccm: `CI-ABJ-2023-B-${10000 + i * 137}`,
        description: l.description,
        phone: `+225 27 ${pad(20 + i)} ${pad(30 + i)} ${pad(40 + i)}`,
        email: `contact@${slugify(l.company)}.${EMAIL_DOMAIN}`,
        address: `${10 + i} avenue des Entrepreneurs, ${l.city}`,
        cityId: cityIds.get(l.city)!,
        status: approved ? "APPROVED" : "PENDING",
        validatedAt: approved ? addDays(new Date(), -120 + i * 3) : null,
        logoUrl: photo(`logo-${slugify(l.company)}`, 1),
        coverUrl: photo(`couverture-${slugify(l.company)}`, 1),
        offersDelivery: l.offersDelivery ?? true,
        deliveryFeeLocal: l.deliveryLocal,
        deliveryFeeRemote: l.deliveryRemote,
        payoutMethod: approved ? pick(["WAVE", "ORANGE_MONEY", "MTN_MONEY", "BANK_TRANSFER"]) : null,
        payoutAccount: approved ? `07${pad(10 + i)}${pad(20 + i)}${pad(30 + i)}` : null,
      },
    });
    await db.subscription.create({ data: { lenderId: lender.id, plan: l.plan ?? "FREE", price: l.plan === "PREMIUM" ? 45000 : l.plan === "PRO" ? 20000 : 0, startsAt: addDays(new Date(), -60), endsAt: l.plan ? addDays(new Date(), 300) : null } });
    const productIds: string[] = [];
    for (const [pi, [name, sub, description, unitPrice, stock, deposit, refundPrice, extra]] of l.products.entries()) {
      const status = !approved ? "DRAFT" : i === 1 && pi === 3 ? "PENDING_REVIEW" : i === 8 && pi === 3 ? "PENDING_REVIEW" : "PUBLISHED";
      const slug = slugify(`${name}-${l.city}`);
      const product = await db.product.create({
        data: {
          slug,
          name,
          description,
          conditions: "Pièce d'identité exigée à la remise. Matériel à restituer propre et complet. Toute casse ou perte est facturée au prix de remplacement.",
          unitPrice,
          stockQuantity: stock,
          depositAmount: deposit,
          refundPrice,
          allowsExtraBilling: extra,
          minDays: 1,
          maxDays: 30,
          status,
          lenderId: lender.id,
          categoryId: categoryIds.get(sub)!,
          cityId: cityIds.get(l.city)!,
          popularity: Math.floor(rnd() * 90) + 10,
          photos: { create: [1, 2, 3].map((n, position) => ({ url: photo(slug, n), alt: `${name}, photo ${n}`, position })) },
        },
      });
      await db.stockMovement.create({ data: { productId: product.id, delta: stock, previousQty: 0, newQty: stock, reason: "INITIAL" } });
      productIds.push(product.id);
    }
    lenders.push({ id: user.id, actor: await actorOf(user.id), lenderId: lender.id, company: l.company, productIds });
  }
  const approvedLenders = lenders.filter((_, i) => (LENDERS[i].status ?? "APPROVED") === "APPROVED");

  // Équipe du premier loueur : un sous-compte par rôle spécialisé, plus un rôle personnalisé.
  const team: [string, string, string, string][] = [
    ["stock", "Mariam", "Doumbia", "STOCK_MANAGER"],
    ["commandes", "Hervé", "Zoro", "ORDER_MANAGER"],
    ["finance", "Carine", "Lago", "FINANCE_MANAGER"],
    ["livraison", "Yacouba", "Sidibé", "DELIVERY_MANAGER"],
    ["retours", "Rose", "Kacou", "RETURN_CONTROLLER"],
  ];
  for (const [key, first, last, roleCode] of team) {
    const role = await db.role.findUniqueOrThrow({ where: { key: `SYSTEM:${roleCode}` } });
    const user = await db.user.create({ data: { email: `${key}.loueur01@${EMAIL_DOMAIN}`, passwordHash, firstName: first, lastName: last, accountType: "LENDER", emailVerifiedAt: new Date() } });
    await db.lenderMember.create({ data: { lenderId: lenders[0].lenderId, userId: user.id, roleId: role.id, createdById: lenders[0].id } });
  }
  const customPerms = await db.permission.findMany({ where: { code: { in: ["ORDER_VIEW", "DELIVERY_VIEW", "RETURN_VIEW", "CUSTOMER_VIEW"] } } });
  await db.role.create({ data: { key: `${lenders[0].lenderId}:CONSULTATION`, code: "CONSULTATION", name: "Consultation seule", description: "Lecture des commandes, livraisons et retours", scope: "LENDER", lenderId: lenders[0].lenderId, permissions: { create: customPerms.map((p) => ({ permissionId: p.id })) } } });

  // --- Réservations réalistes ----------------------------------------------
  const L = (i: number) => approvedLenders[i % approvedLenders.length];
  const productOf = (lender: LenderAcc, n: number) => lender.productIds[n % lender.productIds.length];

  /** Réserve en adaptant quantité et dates si le stock est déjà pris (les scénarios de démonstration se chevauchent). */
  async function book(client: Account, requested: { productId: string; quantity: number; start: number; end: number }[], opts: { delivery?: boolean; pay?: boolean } = {}) {
    await db.cartItem.deleteMany({ where: { cart: { userId: client.id } } });
    const lines = [];
    for (const l of requested) {
      const length = l.end - l.start;
      let start = l.start;
      let quantity = l.quantity;
      for (let tries = 0; tries < 40; tries++) {
        const free = minAvailable(await availabilityForProduct(db, l.productId, addDays(todayUTC(), start), addDays(todayUTC(), start + length)));
        if (free >= 1) {
          quantity = Math.min(quantity, free);
          break;
        }
        start += 4;
      }
      lines.push({ productId: l.productId, quantity, start, end: start + length });
    }
    for (const l of lines) await addToCart(client.id, { productId: l.productId, quantity: l.quantity, startDate: toISODate(addDays(todayUTC(), l.start)), endDate: toISODate(addDays(todayUTC(), l.end)) });
    const user = await db.user.findUniqueOrThrow({ where: { id: client.id } });
    const hold = await createHold(client.id, { fulfillmentType: opts.delivery ? "DELIVERY" : "PICKUP", deliveryAddress: opts.delivery ? user.deliveryAddress ?? "Rue 12, Cocody" : undefined, deliveryCityId: opts.delivery ? user.cityId ?? undefined : undefined, deliveryZone: opts.delivery ? "Quartier résidentiel" : undefined, contactPhone: user.phone ?? undefined, replaceExisting: true });
    const reservation = await createReservationFromHold(client.id, hold.id);
    const methods = ["ORANGE_MONEY", "MTN_MONEY", "WAVE", "MOOV_MONEY", "CARD"] as const;
    const { payment } = await initiatePayment(client.actor, { reservationId: reservation.id, method: pick([...methods]), idempotencyKey: randomUUID() });
    if (opts.pay !== false) await simulatePayment(client.actor, payment.id, "success");
    return db.reservation.findUniqueOrThrow({ where: { id: reservation.id }, include: { items: true } });
  }

  const lenderActor = (lenderId: string) => lenders.find((l) => l.lenderId === lenderId)!.actor as Actor & { lenderId: string };
  const toInUse = async (r: Awaited<ReturnType<typeof book>>) => {
    for (const lenderId of new Set(r.items.map((i) => i.lenderId))) {
      const a = lenderActor(lenderId);
      await lenderAdvance(a, r.id, "READY");
      await lenderAdvance(a, r.id, "IN_USE");
    }
  };

  console.log("Réservations terminées…");
  const completedItems: { itemId: string; client: Account; lenderId: string }[] = [];
  for (let i = 0; i < 14; i++) {
    const client = clients[i % clients.length];
    const lender = L(i);
    const p = productOf(lender, i);
    const qty = Math.min(2 + (i % 5) * 3, 20);
    const r = await book(client, [{ productId: p, quantity: qty, start: 7, end: 7 + 1 + (i % 3) }]);
    await toInUse(r);
    const item = r.items[0];
    const damage = i % 5 === 2;
    const lost = i % 7 === 3;
    let report;
    if (lost) {
      report = await createReturnReport(lenderActor(item.lenderId), item.id, { returnedQuantity: item.quantity - 1, lostQuantity: 1, damagedQuantity: 0, condition: "DAMAGED", comment: "Une unité manquante au retour." }, [{ key: "private/seed/preuve-retour.jpg", mimeType: "image/jpeg" }]);
    } else if (damage) {
      report = await createReturnReport(lenderActor(item.lenderId), item.id, { returnedQuantity: item.quantity, lostQuantity: 0, damagedQuantity: 1, condition: "DAMAGED", damageAmount: Math.max(1000, Math.round(item.refundPrice * 0.3 / 500) * 500), comment: "Une unité abîmée, réparation nécessaire." }, [{ key: "private/seed/preuve-retour.jpg", mimeType: "image/jpeg" }]);
    } else {
      report = await createReturnReport(lenderActor(item.lenderId), item.id, { returnedQuantity: item.quantity, lostQuantity: 0, damagedQuantity: 0, condition: i % 2 ? "GOOD" : "EXCELLENT", comment: "Retour conforme." }, []);
    }
    if (report.status === "SUBMITTED") await acknowledgeReport(client.actor, item.id);
    await shiftBack(r.id, 10 + Math.floor(rnd() * 80));
    completedItems.push({ itemId: item.id, client, lenderId: item.lenderId });
  }

  // Avis sur 10 locations terminées, avec quelques réponses de loueurs.
  for (const [i, c] of completedItems.slice(0, 10).entries()) {
    const review = await createReview(c.client.actor, c.itemId, {
      productRating: i % 6 === 5 ? 3 : 4 + (i % 2),
      lenderRating: i % 6 === 5 ? 3 : 4 + ((i + 1) % 2),
      experienceRating: i % 6 === 5 ? 3 : 5 - (i % 3 === 0 ? 1 : 0),
      comment: REVIEW_COMMENTS[i % REVIEW_COMMENTS.length],
    });
    const item = await db.reservationItem.findUniqueOrThrow({ where: { id: c.itemId } });
    await db.review.update({ where: { id: review.id }, data: { createdAt: addDays(item.endDate, 1 + (i % 3)) } });
    if (i % 3 === 0) await replyToReview(lenderActor(c.lenderId), review.id, "Merci pour votre confiance, au plaisir de vous revoir pour votre prochain événement.");
  }

  console.log("Locations en cours et à venir…");
  // En cours (début hier ou aujourd'hui).
  for (let i = 0; i < 5; i++) {
    const client = clients[(i + 3) % clients.length];
    const lender = L(i + 2);
    const r = await book(client, [{ productId: productOf(lender, i + 1), quantity: 2 + i, start: 8, end: 12 + i }], { delivery: i % 2 === 0 });
    if (r.fulfillmentType === "DELIVERY") {
      const a = lenderActor(lender.lenderId);
      for (const d of await db.delivery.findMany({ where: { reservationId: r.id } })) {
        await lenderAdvance(a, r.id, "READY");
        for (const status of ["PREPARING", "OUT_FOR_DELIVERY", "DELIVERED"] as const) await updateDelivery(a, d.id, { status, scheduledDate: toISODate(addDays(todayUTC(), 8)), slotStart: "09:00", slotEnd: "12:00" });
      }
    } else {
      await toInUse(r);
    }
    await shiftBack(r.id, 9);
  }
  // À venir : confirmées, préparées, avec livraison planifiée.
  for (let i = 0; i < 8; i++) {
    const client = clients[(i + 5) % clients.length];
    const lender = L(i + 4);
    const items = i % 3 === 0 ? [{ productId: productOf(lender, i), quantity: 3, start: 3 + i, end: 5 + i }, { productId: productOf(L(i + 7), i + 1), quantity: 2, start: 3 + i, end: 5 + i }] : [{ productId: productOf(lender, i), quantity: 2 + i, start: 3 + i * 2, end: 5 + i * 2 }];
    const r = await book(client, items, { delivery: i % 2 === 1 });
    if (i % 3 === 1) for (const lenderId of new Set(r.items.map((it) => it.lenderId))) await lenderAdvance(lenderActor(lenderId), r.id, "READY");
    if (r.fulfillmentType === "DELIVERY") {
      const d = await db.delivery.findFirst({ where: { reservationId: r.id } });
      if (d) await updateDelivery(lenderActor(d.lenderId), d.id, { status: "PREPARING", slotStart: "14:00", slotEnd: "17:00" });
    }
  }

  console.log("Retours en attente, annulations, recouvrement…");
  // Retour attendu : la location s'est terminée hier, aucun constat.
  for (let i = 0; i < 2; i++) {
    const r = await book(clients[(i + 8) % clients.length], [{ productId: productOf(L(i + 9), i), quantity: 2, start: 7, end: 9 }]);
    await toInUse(r);
    await shiftBack(r.id, 10);
  }
  // Annulation anticipée, remboursement intégral.
  {
    const r = await book(clients[2], [{ productId: productOf(L(1), 1), quantity: 2, start: 25, end: 27 }]);
    await cancelReservation(clients[2].actor, r.id, { reason: "Changement de date de l'événement" });
  }
  // Annulation après versement : recouvrement à traiter.
  {
    const lender = L(5);
    const r = await book(clients[6], [{ productId: productOf(lender, 0), quantity: 3, start: 6, end: 8 }]);
    const itemId = r.items[0].id;
    await db.balanceEntry.updateMany({ where: { itemId }, data: { availableAt: new Date(Date.now() - 3600_000) } });
    await runPayout(finance.actor, lender.lenderId);
    await cancelReservation(finance.actor, r.id, { reason: "Erreur de saisie du client, annulation validée par le support", refundPercent: 100 });
  }

  console.log("Litiges, contestation, modifications…");
  // Litige ciblé sur un seul loueur dans une réservation multi-loueurs.
  {
    const a = L(0);
    const b = L(3);
    const r = await book(clients[0], [{ productId: productOf(a, 0), quantity: 4, start: 8, end: 11 }, { productId: productOf(b, 1), quantity: 1, start: 8, end: 11 }]);
    await toInUse(r);
    await shiftBack(r.id, 9);
    await openDispute(clients[0].actor, { reservationId: r.id, lenderId: b.lenderId, itemId: r.items.find((i) => i.lenderId === b.lenderId)!.id, reason: "Matériel non conforme", description: "L'enceinte livrée ne fonctionnait pas correctement, le son saturait dès la moitié du volume.", disputedAmount: 15000 });
  }
  // Litige résolu en faveur partielle du client.
  {
    const lender = L(6);
    const r = await book(clients[4], [{ productId: productOf(lender, 2), quantity: 1, start: 8, end: 10 }]);
    await toInUse(r);
    await shiftBack(r.id, 14);
    const dispute = await openDispute(clients[4].actor, { reservationId: r.id, lenderId: lender.lenderId, reason: "Retard de remise", description: "Le matériel a été remis avec plus de quatre heures de retard, ce qui a perturbé notre installation.", disputedAmount: 12000 });
    await decideDispute(admin.actor, dispute.id, { outcome: "PARTIAL", amount: 5000, decision: "Retard établi par les échanges. Un remboursement partiel de 5 000 FCFA est accordé au client." });
  }
  // Constat de retour contesté : caution gelée.
  {
    const lender = L(2);
    const client = clients[9];
    const r = await book(client, [{ productId: productOf(lender, 0), quantity: 1, start: 7, end: 9 }]);
    await toInUse(r);
    const item = r.items[0];
    await createReturnReport(lenderActor(lender.lenderId), item.id, { returnedQuantity: 1, lostQuantity: 0, damagedQuantity: 1, condition: "DAMAGED", damageAmount: Math.round(item.refundPrice * 0.2 / 500) * 500, comment: "Tache importante sur l'assise." }, [{ key: "private/seed/preuve-retour.jpg", mimeType: "image/jpeg" }]);
    await contestReport(client.actor, item.id, "La tache était déjà présente lors de la remise, j'ai les photos prises à la livraison.");
  }
  // Demandes de modification : une en attente de validation, une escaladée à l'administration.
  {
    const lender = L(7);
    const r = await book(clients[10], [{ productId: productOf(lender, 0), quantity: 2, start: 12, end: 14 }]);
    await requestModification(clients[10].actor, r.id, { reason: "Nous attendons plus d'invités", lines: [{ action: "UPDATE", itemId: r.items[0].id, quantity: 4 }] });
    const lender2 = L(8);
    const r2 = await book(clients[11], [{ productId: productOf(lender2, 1), quantity: 3, start: 15, end: 17 }]);
    const mod = await requestModification(clients[11].actor, r2.id, { reason: "Décalage d'un jour de l'événement", lines: [{ action: "UPDATE", itemId: r2.items[0].id, startDate: toISODate(addDays(todayUTC(), 16)), endDate: toISODate(addDays(todayUTC(), 18)) }] });
    await db.modificationRequest.update({ where: { id: mod.id }, data: { respondBy: new Date(Date.now() - 30 * 60_000) } });
    await escalateAndExpireModifications();
  }

  console.log("Paniers, blocages, favoris, versements…");
  // Client de démonstration avec un panier multi-loueurs prêt à payer.
  await db.cartItem.deleteMany({ where: { cart: { userId: clients[0].id } } });
  await addToCart(clients[0].id, { productId: productOf(L(0), 2), quantity: 50, startDate: toISODate(addDays(todayUTC(), 20)), endDate: toISODate(addDays(todayUTC(), 22)) });
  await addToCart(clients[0].id, { productId: productOf(L(1), 0), quantity: 1, startDate: toISODate(addDays(todayUTC(), 20)), endDate: toISODate(addDays(todayUTC(), 22)) });
  // Un HOLD abandonné qui a expiré (alimente l'indicateur de HOLD non convertis).
  for (let i = 0; i < 3; i++) {
    const c = clients[7];
    await db.cartItem.deleteMany({ where: { cart: { userId: c.id } } });
    await addToCart(c.id, { productId: productOf(L(i + 1), i), quantity: 1, startDate: toISODate(addDays(todayUTC(), 30 + i)), endDate: toISODate(addDays(todayUTC(), 31 + i)) });
    const h = await createHold(c.id, { fulfillmentType: "PICKUP", replaceExisting: true });
    await db.hold.update({ where: { id: h.id }, data: { expiresAt: new Date(Date.now() - 60_000) } });
  }
  await db.cartItem.deleteMany({ where: { cart: { userId: clients[7].id } } });
  // Un HOLD actif en attente de paiement.
  {
    await db.cartItem.deleteMany({ where: { cart: { userId: clients[1].id } } });
    await addToCart(clients[1].id, { productId: productOf(L(3), 0), quantity: 1, startDate: toISODate(addDays(todayUTC(), 40)), endDate: toISODate(addDays(todayUTC(), 42)) });
    const h = await createHold(clients[1].id, { fulfillmentType: "PICKUP", replaceExisting: true });
    await createReservationFromHold(clients[1].id, h.id);
  }
  await runMaintenance();
  await expireHolds();

  for (const [i, c] of clients.entries()) {
    const favs = [productOf(L(i), 0), productOf(L(i + 3), 1), productOf(L(i + 6), 2)];
    for (const productId of favs) await db.favorite.upsert({ where: { userId_productId: { userId: c.id, productId } }, update: {}, create: { userId: c.id, productId } });
  }

  // Versements : certains loueurs sont déjà payés pour leurs ventes anciennes.
  for (const lender of approvedLenders) await runPayout(finance.actor, lender.lenderId).catch(() => null);

  // Mises en avant, validation en attente, scores.
  for (const [i, lender] of [L(0), L(1), L(3), L(12)].entries()) await createPromotion(admin.actor, { productId: productOf(lender, i), type: i % 2 ? "SPONSORED" : "FEATURED", days: 60, amountPaid: 15000 });
  await db.validationAction.create({ data: { type: "PAYOUT_DETAILS", entity: "Lender", entityId: lenders[1].lenderId, lenderId: lenders[1].lenderId, requestedById: lenders[1].id, payload: { method: "BANK_TRANSFER", account: "CI93 0001 2345 6789 0123 4567 8901" }, reason: "Changement de banque" } });
  await db.lenderUnavailability.create({ data: { lenderId: lenders[0].lenderId, startDate: addDays(todayUTC(), 45), endDate: addDays(todayUTC(), 48), reason: "Inventaire annuel" } });
  for (const c of clients) await computeClientScore(c.id);
  for (const l of approvedLenders) await computeLenderScore(l.lenderId);

  const counts = {
    catégories: await db.category.count(),
    villes: await db.city.count(),
    loueurs: await db.lender.count(),
    produits: await db.product.count(),
    clients: await db.user.count({ where: { accountType: "CLIENT" } }),
    réservations: await db.reservation.count(),
    paiements: await db.payment.count(),
    cautions: await db.deposit.count(),
    litiges: await db.dispute.count(),
    avis: await db.review.count(),
    livraisons: await db.delivery.count(),
    notifications: await db.notification.count(),
  };
  console.log("\nDonnées de démonstration créées :", counts);
  console.log(`\nComptes (mot de passe : ${PASSWORD})`);
  console.log(`  Super admin      admin@${EMAIL_DOMAIN}`);
  console.log(`  Admin finance    finance@${EMAIL_DOMAIN}   (support@, moderation@, stock@)`);
  console.log(`  Client           client01@${EMAIL_DOMAIN}   (client01 à client12 ; client01 a un panier prêt à payer)`);
  console.log(`  Loueur           loueur01@${EMAIL_DOMAIN}   (loueur01 à loueur16 ; loueur16 est en attente de validation)`);
  console.log(`  Sous-comptes     stock.loueur01@, commandes.loueur01@, finance.loueur01@, livraison.loueur01@, retours.loueur01@`);
  void parseDate;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
