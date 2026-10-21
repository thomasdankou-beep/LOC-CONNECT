import { ok, route } from "@/lib/http/route";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { requireLender } from "@/lib/auth/actor";
import { publicUrl, saveUpload } from "@/lib/storage";

/** POST /api/lenders/me/logo : téléverse le logo de l'entreprise (JPEG, PNG ou WebP, 6 Mo max), affiché sur la page publique et en en-tête des documents. */
export const POST = route(async ({ req }) => {
  const actor = await requireLender("COMPANY_MANAGE");
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw new AppError("VALIDATION_ERROR", "Fichier manquant.");
  const before = await db.lender.findUniqueOrThrow({ where: { id: actor.lenderId }, select: { logoUrl: true } });
  const saved = await saveUpload(file, `lenders/${actor.lenderId}`, "public");
  const lender = await db.lender.update({ where: { id: actor.lenderId }, data: { logoUrl: publicUrl(saved.key) } });
  // Les documents déjà émis gardent l'adresse de l'ancien logo : il n'est pas supprimé.
  await audit(db, { userId: actor.userId, lenderId: actor.lenderId, action: "company.logo", entity: "Lender", entityId: actor.lenderId, oldValue: { logoUrl: before.logoUrl }, newValue: { logoUrl: lender.logoUrl }, meta: actor.meta });
  return ok({ logoUrl: lender.logoUrl });
});

/** DELETE /api/lenders/me/logo : retire le logo des prochains documents. */
export const DELETE = route(async () => {
  const actor = await requireLender("COMPANY_MANAGE");
  await db.lender.update({ where: { id: actor.lenderId }, data: { logoUrl: null } });
  await audit(db, { userId: actor.userId, lenderId: actor.lenderId, action: "company.logo_remove", entity: "Lender", entityId: actor.lenderId, meta: actor.meta });
  return ok({ logoUrl: null });
});
