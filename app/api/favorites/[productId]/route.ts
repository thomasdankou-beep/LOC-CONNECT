import { created, ok, route } from "@/lib/http/route";
import { db } from "@/lib/db";
import { notFound } from "@/lib/errors";
import { requireClient } from "@/lib/auth/actor";

/** POST /api/favorites/:productId : ajoute un favori (idempotent). */
export const POST = route<{ productId: string }>(async ({ params }) => {
  const actor = await requireClient();
  if (!(await db.product.findFirst({ where: { id: params.productId, deletedAt: null } }))) throw notFound("Produit");
  await db.favorite.upsert({ where: { userId_productId: { userId: actor.userId, productId: params.productId } }, update: {}, create: { userId: actor.userId, productId: params.productId } });
  return created({ favorite: true });
});

/** DELETE /api/favorites/:productId : retire un favori. */
export const DELETE = route<{ productId: string }>(async ({ params }) => {
  const actor = await requireClient();
  await db.favorite.deleteMany({ where: { userId: actor.userId, productId: params.productId } });
  return ok({ favorite: false });
});
