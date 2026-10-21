import { ok, parseBody, route } from "@/lib/http/route";
import { requireAdmin } from "@/lib/auth/actor";
import { decideLender, lenderDecision } from "@/services/admin";

/** PATCH /api/admin/lenders/:id : valider, rejeter, suspendre ou réactiver un loueur (motif obligatoire pour rejeter ou suspendre). */
export const PATCH = route<{ id: string }>(async ({ req, params }) => ok(await decideLender(await requireAdmin(), params.id, await parseBody(req, lenderDecision))));
