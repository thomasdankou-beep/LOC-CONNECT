import { created, ok, route } from "@/lib/http/route";
import { db } from "@/lib/db";
import { AppError, notFound } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { can, requireLender } from "@/lib/auth/actor";
import { publicUrl, saveUpload, storage } from "@/lib/storage";

async function own(lenderId: string, id: string) {
  const product = await db.product.findFirst({ where: { id, lenderId, deletedAt: null }, include: { photos: true } });
  if (!product) throw notFound("Produit");
  return product;
}

/** POST /api/products/:id/photos : téléverse une photo publique (JPEG, PNG ou WebP, 6 Mo max). */
export const POST = route<{ id: string }>(async ({ req, params }) => {
  const actor = await requireLender("PRODUCT_UPDATE");
  const product = await own(actor.lenderId, params.id);
  if (product.photos.length >= 10) throw new AppError("VALIDATION_ERROR", "10 photos maximum par produit.");
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw new AppError("VALIDATION_ERROR", "Fichier manquant.");
  const saved = await saveUpload(file, `products/${product.id}`, "public");
  const photo = await db.productPhoto.create({ data: { productId: product.id, url: publicUrl(saved.key), alt: product.name, position: product.photos.length } });
  await audit(db, { userId: actor.userId, lenderId: actor.lenderId, action: "product.photo_add", entity: "Product", entityId: product.id, meta: actor.meta });
  return created(photo);
});

/** DELETE /api/products/:id/photos?photoId=... : supprime une photo. */
export const DELETE = route<{ id: string }>(async ({ req, params }) => {
  const actor = await requireLender();
  if (!can(actor, "PRODUCT_UPDATE")) throw new AppError("FORBIDDEN", "Votre rôle ne permet pas cette action.");
  const product = await own(actor.lenderId, params.id);
  const photoId = req.nextUrl.searchParams.get("photoId");
  const photo = product.photos.find((p) => p.id === photoId);
  if (!photo) throw notFound("Photo");
  await db.productPhoto.delete({ where: { id: photo.id } });
  if (photo.url.startsWith("/api/files/")) await storage().delete(photo.url.replace("/api/files/", "")).catch(() => undefined);
  return ok({ deleted: true });
});
