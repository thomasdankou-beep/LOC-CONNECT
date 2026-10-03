import { ok, route } from "@/lib/http/route";
import { requireLender } from "@/lib/auth/actor";
import { lenderBalance, listBalanceEntries } from "@/services/payouts";

/** GET /api/lenders/me/balance : soldes et écritures (gelés, bloqués, disponibles, déductions). */
export const GET = route(async ({ req }) => {
  const actor = await requireLender("FINANCE_VIEW");
  const page = Number(req.nextUrl.searchParams.get("page") ?? 1);
  return ok({ balance: await lenderBalance(actor.lenderId), entries: await listBalanceEntries(actor.lenderId, { page }) });
});
