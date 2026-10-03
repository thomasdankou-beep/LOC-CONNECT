import { NextResponse } from "next/server";
import { route } from "@/lib/http/route";
import { db } from "@/lib/db";
import { forbidden, notFound } from "@/lib/errors";
import { can, getActor } from "@/lib/auth/actor";
import { storage } from "@/lib/storage";

/**
 * GET /api/files/public/... : photos de produits, publiques et mises en cache.
 * GET /api/files/private/... : preuves de retour, pièces de litige, preuves de livraison. Accès contrôlé :
 * client concerné, loueur concerné et rôles administrateurs seulement.
 */
export const GET = route<{ path: string[] }>(async ({ params }): Promise<NextResponse> => {
  const key = params.path.join("/");
  if (key.includes("..")) throw notFound("Fichier");
  const isPublic = key.startsWith("public/");

  if (!isPublic) {
    if (!key.startsWith("private/")) throw notFound("Fichier");
    const actor = await getActor();
    if (!actor) throw forbidden();
    let allowed = false;
    const photo = await db.returnPhoto.findFirst({ where: { storageKey: key }, include: { report: { include: { item: { include: { reservation: true } } } } } });
    if (photo) {
      const item = photo.report.item;
      allowed =
        (actor.accountType === "CLIENT" && item.reservation.clientId === actor.userId) ||
        (actor.accountType === "LENDER" && item.lenderId === actor.lenderId && (can(actor, "RETURN_VIEW") || can(actor, "RETURN_EVIDENCE_CREATE"))) ||
        (actor.accountType === "ADMIN" && (can(actor, "ADMIN_RETURNS") || can(actor, "ADMIN_DISPUTES")));
    }
    if (!photo) {
      const att = await db.attachment.findFirst({ where: { storageKey: key }, include: { dispute: { include: { reservation: true } } } });
      if (att?.dispute) {
        allowed =
          (actor.accountType === "CLIENT" && att.dispute.reservation.clientId === actor.userId) ||
          (actor.accountType === "LENDER" && att.dispute.lenderId === actor.lenderId && can(actor, "DISPUTE_VIEW")) ||
          (actor.accountType === "ADMIN" && can(actor, "ADMIN_DISPUTES"));
      }
    }
    if (!photo && !allowed) {
      const proof = await db.deliveryProof.findFirst({ where: { storageKey: key }, include: { delivery: { include: { reservation: true } } } });
      if (proof) {
        allowed =
          (actor.accountType === "CLIENT" && proof.delivery.reservation.clientId === actor.userId) ||
          (actor.accountType === "LENDER" && proof.delivery.lenderId === actor.lenderId) ||
          (actor.accountType === "ADMIN" && can(actor, "ADMIN_DELIVERIES"));
      }
    }
    if (!allowed) throw forbidden("Accès refusé à ce fichier.");
  }

  const file = await storage().get(key);
  if (!file) throw notFound("Fichier");
  return new NextResponse(new Uint8Array(file.body), {
    headers: {
      "Content-Type": file.contentType,
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": isPublic ? "public, max-age=86400, immutable" : "private, no-store",
    },
  });
}, { skipRateLimit: true });
