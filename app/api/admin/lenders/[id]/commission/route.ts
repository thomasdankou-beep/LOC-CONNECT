import { ok, parseBody, route } from "@/lib/http/route";
import { requireAdmin } from "@/lib/auth/actor";
import { lenderCommissionInput, setLenderCommission } from "@/services/admin";

/** PATCH /api/admin/lenders/:id/commission : taux de commission spécifique (null = taux par défaut). Appliqué aux nouvelles réservations uniquement. */
export const PATCH = route<{ id: string }>(async ({ req, params }) => {
  const { commissionRateBps } = await parseBody(req, lenderCommissionInput);
  return ok(await setLenderCommission(await requireAdmin(), params.id, commissionRateBps));
});
