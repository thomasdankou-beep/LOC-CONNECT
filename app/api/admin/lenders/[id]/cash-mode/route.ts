import { ok, parseBody, route } from "@/lib/http/route";
import { requireAdmin } from "@/lib/auth/actor";
import { lenderCashInput, setLenderCashMode } from "@/services/admin";

/** PUT /api/admin/lenders/:id/cash-mode : ouvre ou retire au loueur le mode acompte en ligne + solde en espèces. */
export const PUT = route<{ id: string }>(async ({ req, params }) => {
  const { cashModeAllowed } = await parseBody(req, lenderCashInput);
  return ok(await setLenderCashMode(await requireAdmin(), params.id, cashModeAllowed));
});
