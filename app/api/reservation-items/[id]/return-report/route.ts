import { created, ok, route } from "@/lib/http/route";
import { db } from "@/lib/db";
import { AppError, forbidden, notFound } from "@/lib/errors";
import { can, requireActor, requireLender } from "@/lib/auth/actor";
import { saveUpload } from "@/lib/storage";
import { createReturnReport, returnReportInput } from "@/services/returns";

/**
 * POST /api/reservation-items/:id/return-report : constat de retour par ligne (multipart : champ `data` JSON + fichiers `photos`).
 * Les photos de retour sont privées : jamais publiques, accessibles au client, au loueur concerné et à l'administration.
 */
export const POST = route<{ id: string }>(async ({ req, params }) => {
  const actor = await requireLender("RETURN_CREATE");
  const form = await req.formData();
  let raw: unknown;
  try {
    raw = JSON.parse(String(form.get("data") ?? "{}"));
  } catch {
    throw new AppError("BAD_REQUEST", "Champ data invalide.");
  }
  const input = returnReportInput.parse(raw);
  const files = form.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length > 8) throw new AppError("VALIDATION_ERROR", "8 photos maximum.");
  if (files.length && !can(actor, "RETURN_EVIDENCE_CREATE")) throw forbidden("Votre rôle ne permet pas d'ajouter des preuves de retour.");
  const stored = [];
  for (const f of files) {
    const s = await saveUpload(f, `returns/${params.id}`, "private");
    stored.push({ key: s.key, mimeType: s.mimeType });
  }
  return created(await createReturnReport(actor, params.id, input, stored));
});

/** GET /api/reservation-items/:id/return-report : constat (client, loueur concerné, admin). */
export const GET = route<{ id: string }>(async ({ params }) => {
  const actor = await requireActor();
  const report = await db.returnReport.findUnique({ where: { itemId: params.id }, include: { photos: { select: { id: true, storageKey: true, mimeType: true } }, item: { include: { reservation: { select: { clientId: true } } } } } });
  if (!report) throw notFound("Constat de retour");
  const allowed =
    (actor.accountType === "CLIENT" && report.item.reservation.clientId === actor.userId) ||
    (actor.accountType === "LENDER" && report.item.lenderId === actor.lenderId && can(actor, "RETURN_VIEW")) ||
    (actor.accountType === "ADMIN" && can(actor, "ADMIN_RETURNS"));
  if (!allowed) throw forbidden();
  const { item, ...rest } = report;
  void item;
  return ok(rest);
});
