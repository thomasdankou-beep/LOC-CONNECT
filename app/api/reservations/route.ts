import { z } from "zod";
import { created, ok, parseBody, parseQuery, route } from "@/lib/http/route";
import { requireActor, requireClient } from "@/lib/auth/actor";
import { AppError, forbidden } from "@/lib/errors";
import { createReservationFromHold, listClientReservations, listLenderReservations } from "@/services/reservations";
import { listReservations } from "@/services/admin";

/** POST /api/reservations : crée la réservation (statut HOLD) depuis un blocage de stock actif. Montants recalculés côté serveur. */
export const POST = route(async ({ req }) => {
  const actor = await requireClient();
  const { holdId } = await parseBody(req, z.object({ holdId: z.string().min(1) }));
  return created(await createReservationFromHold(actor.userId, holdId));
});

const query = z.object({ status: z.string().optional(), page: z.coerce.number().int().min(1).optional(), q: z.string().optional() });

/** GET /api/reservations : liste selon le rôle (client : les siennes ; loueur : ses lignes ; admin : toutes). */
export const GET = route(async ({ req }) => {
  const actor = await requireActor();
  const q = parseQuery(req, query);
  const status = q.status ? (q.status.split(",") as never[]) : undefined;
  if (actor.accountType === "CLIENT") return ok(await listClientReservations(actor.userId, { status, page: q.page }));
  if (actor.accountType === "LENDER") {
    if (!actor.lenderId) throw forbidden();
    return ok(await listLenderReservations(actor.lenderId, { status, page: q.page, q: q.q }));
  }
  if (actor.accountType === "ADMIN") return ok(await listReservations(actor, { status: q.status, page: q.page, q: q.q }));
  throw new AppError("FORBIDDEN", "Accès refusé.");
});
