import { z } from "zod";
import { db, transaction, type Tx } from "@/lib/db";
import { AppError, forbidden, notFound } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { getSettings } from "@/lib/settings";
import { can, type Actor } from "@/lib/auth/actor";
import { notifyLender } from "./notifications";

const rating = z.number().int().min(1).max(5);
export const reviewInput = z.object({
  productRating: rating,
  lenderRating: rating,
  experienceRating: rating,
  comment: z.string().trim().max(1500).optional(),
});

async function refreshAggregates(tx: Tx, productId: string, lenderId: string) {
  const p = await tx.review.aggregate({ where: { productId, status: "PUBLISHED" }, _avg: { productRating: true }, _count: true });
  await tx.product.update({ where: { id: productId }, data: { ratingAvg: Math.round((p._avg.productRating ?? 0) * 10) / 10, reviewCount: p._count } });
  const l = await tx.review.aggregate({ where: { lenderId, status: "PUBLISHED" }, _avg: { lenderRating: true }, _count: true });
  await tx.lender.update({ where: { id: lenderId }, data: { ratingAvg: Math.round((l._avg.lenderRating ?? 0) * 10) / 10, reviewCount: l._count } });
}

/** Un avis par ligne, uniquement après une location terminée. Note produit, loueur et expérience. */
export async function createReview(actor: Actor, itemId: string, input: z.infer<typeof reviewInput>) {
  if (actor.accountType !== "CLIENT") throw forbidden();
  const settings = await getSettings();
  const item = await db.reservationItem.findFirst({ where: { id: itemId, reservation: { clientId: actor.userId } }, include: { review: true } });
  if (!item) throw notFound("Ligne de réservation");
  if (item.status !== "COMPLETED") throw new AppError("CONFLICT", "Vous pouvez donner votre avis une fois la location terminée.");
  if (item.review) throw new AppError("CONFLICT", "Vous avez déjà donné votre avis sur cette location.");
  return transaction(async (tx) => {
    const review = await tx.review.create({
      data: { itemId, clientId: actor.userId, lenderId: item.lenderId, productId: item.productId, ...input, status: settings["moderation.reviews_require_approval"] ? "PENDING" : "PUBLISHED" },
    });
    if (review.status === "PUBLISHED") await refreshAggregates(tx, item.productId, item.lenderId);
    await audit(tx, { userId: actor.userId, action: "review.create", entity: "Review", entityId: review.id, newValue: { ...input }, meta: actor.meta });
    await notifyLender(tx, item.lenderId, { type: "review.new", title: `Nouvel avis sur ${item.productName}`, body: `Note du loueur : ${input.lenderRating}/5.`, link: "/loueur/avis" }, "REVIEW_VIEW");
    return review;
  });
}

export const replyInput = z.object({ reply: z.string().trim().min(2).max(1000) });

export async function replyToReview(actor: Actor & { lenderId: string }, reviewId: string, reply: string) {
  if (!can(actor, "REVIEW_REPLY")) throw forbidden();
  const review = await db.review.findFirst({ where: { id: reviewId, lenderId: actor.lenderId } });
  if (!review) throw notFound("Avis");
  return db.review.update({ where: { id: reviewId }, data: { lenderReply: reply, lenderRepliedAt: new Date() } });
}

export async function moderateReview(actor: Actor, reviewId: string, status: "PUBLISHED" | "HIDDEN") {
  if (actor.accountType !== "ADMIN" || !can(actor, "ADMIN_REVIEWS")) throw forbidden();
  return transaction(async (tx) => {
    const review = await tx.review.findUnique({ where: { id: reviewId } });
    if (!review) throw notFound("Avis");
    const updated = await tx.review.update({ where: { id: reviewId }, data: { status } });
    await refreshAggregates(tx, review.productId, review.lenderId);
    await audit(tx, { userId: actor.userId, action: "review.moderate", entity: "Review", entityId: reviewId, oldValue: { status: review.status }, newValue: { status }, meta: actor.meta });
    return updated;
  });
}

export async function listLenderReviews(lenderId: string) {
  return db.review.findMany({ where: { lenderId }, include: { client: { select: { firstName: true, lastName: true } }, product: { select: { name: true, slug: true } } }, orderBy: { createdAt: "desc" }, take: 100 });
}

export async function listClientReviews(userId: string) {
  return db.review.findMany({ where: { clientId: userId }, include: { product: { select: { name: true, slug: true } }, lender: { select: { companyName: true } } }, orderBy: { createdAt: "desc" } });
}
