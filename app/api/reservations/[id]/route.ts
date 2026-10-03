import { z } from "zod";
import { ok, parseBody, route } from "@/lib/http/route";
import { requireActor, requireLender } from "@/lib/auth/actor";
import { AppError } from "@/lib/errors";
import { adminSetItemStatus, getReservationDetail, lenderAdvance } from "@/services/reservations";

/** GET /api/reservations/:id : détail selon le périmètre (le loueur ne voit que ses lignes). */
export const GET = route<{ id: string }>(async ({ params }) => {
  const actor = await requireActor();
  const { reservation, scope } = await getReservationDetail(actor, params.id);
  return ok(reservation, 200, { meta: { scope: scope.kind } });
});

const patch = z.object({
  status: z.enum(["CONFIRMED", "READY", "IN_USE", "CANCELLED", "REFUNDED", "COMPLETED", "RETURNED", "RETURN_PENDING", "DELIVERED", "DELIVERING", "PAID"]),
  itemIds: z.array(z.string()).optional(),
  note: z.string().trim().max(300).optional(),
});

/**
 * PATCH /api/reservations/:id : fait avancer le statut des lignes. Un loueur peut valider, préparer et remettre
 * (permissions ORDER_*). L'administration peut corriger un statut (motif obligatoire, audité). Transitions validées par la machine à états.
 */
export const PATCH = route<{ id: string }>(async ({ req, params }) => {
  const actor = await requireActor();
  const input = await parseBody(req, patch);
  if (actor.accountType === "LENDER") {
    const lender = await requireLender();
    if (!["CONFIRMED", "READY", "IN_USE"].includes(input.status)) throw new AppError("FORBIDDEN", "Statut non autorisé pour un loueur.");
    return ok(await lenderAdvance(lender, params.id, input.status as "CONFIRMED" | "READY" | "IN_USE", input.itemIds));
  }
  if (actor.accountType === "ADMIN") {
    if (!input.note) throw new AppError("VALIDATION_ERROR", "Un motif est obligatoire pour une correction administrative.");
    return ok(await adminSetItemStatus(actor, params.id, input.status, input.itemIds, input.note));
  }
  throw new AppError("FORBIDDEN", "Accès refusé.");
});
