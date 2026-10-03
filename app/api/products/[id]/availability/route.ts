import { z } from "zod";
import { created, ok, parseBody, parseQuery, route } from "@/lib/http/route";
import { db } from "@/lib/db";
import { AppError, notFound } from "@/lib/errors";
import { requireLender } from "@/lib/auth/actor";
import { addDays, daysBetween, parseDate, todayUTC } from "@/lib/dates";
import { availabilityForProduct } from "@/services/availability";
import { blockInput, createBlock, deleteBlock } from "@/services/products";

const range = z.object({ start: z.string().optional(), end: z.string().optional() });

/** GET /api/products/:id/availability?start&end : disponibilité jour par jour (60 jours max). Public. */
export const GET = route<{ id: string }>(async ({ req, params }) => {
  const q = parseQuery(req, range);
  const product = await db.product.findFirst({ where: { OR: [{ id: params.id }, { slug: params.id }], deletedAt: null, status: "PUBLISHED" }, select: { id: true } });
  if (!product) throw notFound("Produit");
  const start = q.start ? parseDate(q.start) : todayUTC();
  const end = q.end ? parseDate(q.end) : addDays(start, 60);
  if (end <= start || daysBetween(start, end) > 92) throw new AppError("VALIDATION_ERROR", "Période invalide (92 jours maximum).");
  return ok(await availabilityForProduct(db, product.id, start, end));
});

/** POST /api/products/:id/availability : un loueur bloque une quantité sur une période (maintenance, usage interne). */
export const POST = route<{ id: string }>(async ({ req, params }) => {
  const actor = await requireLender();
  return created(await createBlock(actor, params.id, await parseBody(req, blockInput)));
});

/** DELETE /api/products/:id/availability?blockId=... : lève un blocage. */
export const DELETE = route<{ id: string }>(async ({ req }) => {
  const actor = await requireLender();
  const blockId = req.nextUrl.searchParams.get("blockId");
  if (!blockId) throw new AppError("VALIDATION_ERROR", "blockId requis.");
  await deleteBlock(actor, blockId);
  return ok({ deleted: true });
});
