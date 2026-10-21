import { ok, parseBody, route } from "@/lib/http/route";
import { requireLender } from "@/lib/auth/actor";
import { choosePlan, choosePlanInput, simulatePlans } from "@/services/plans";

/** GET /api/lenders/me/plan : formule en cours et simulation du coût de chaque formule sur les 30 derniers jours. */
export const GET = route(async () => ok(await simulatePlans((await requireLender()).lenderId)));

/** PUT /api/lenders/me/plan : changer de formule (plus chère : immédiat et facturé ; moins chère : à l'échéance). */
export const PUT = route(async ({ req }) => {
  const { plan } = await parseBody(req, choosePlanInput);
  return ok(await choosePlan(await requireLender(), plan));
});
