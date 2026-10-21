import { ok, parseBody, route } from "@/lib/http/route";
import { db } from "@/lib/db";
import { notFound } from "@/lib/errors";
import { requireLender } from "@/lib/auth/actor";
import { deleteProduct, productPatch, updateProduct } from "@/services/products";

/** GET /api/products/:id : fiche publique d'un produit publié (par identifiant ou slug). */
export const GET = route<{ id: string }>(async ({ params }) => {
  const product = await db.product.findFirst({
    where: { OR: [{ id: params.id }, { slug: params.id }], status: "PUBLISHED", deletedAt: null, lender: { status: "APPROVED" } },
    include: { photos: { orderBy: { position: "asc" } }, lender: { select: { id: true, slug: true, companyName: true, ratingAvg: true, reviewCount: true } }, category: true, city: true },
  });
  if (!product) throw notFound("Produit");
  return ok(product);
});

/** PATCH /api/products/:id : modification par le loueur propriétaire (prix historisé). */
export const PATCH = route<{ id: string }>(async ({ req, params }) => {
  const actor = await requireLender();
  const patch = await parseBody(req, productPatch);
  return ok(await updateProduct(actor, params.id, patch));
});

/** DELETE /api/products/:id : suppression logique (refusée si des locations sont en cours). */
export const DELETE = route<{ id: string }>(async ({ params }) => {
  const actor = await requireLender();
  await deleteProduct(actor, params.id);
  return ok({ deleted: true });
});
