import { ok, parseBody, route } from "@/lib/http/route";
import { db } from "@/lib/db";
import { requireLender } from "@/lib/auth/actor";
import { companyInput, updateCompany } from "@/services/lenders";
import { lenderBalance } from "@/services/payouts";

/** GET /api/lenders/me : entreprise du loueur connecté et soldes (gelé, bloqué, disponible, déductions). */
export const GET = route(async () => {
  const actor = await requireLender();
  const [lender, balance] = await Promise.all([db.lender.findUniqueOrThrow({ where: { id: actor.lenderId }, include: { city: true, subscriptions: { where: { status: "ACTIVE" }, take: 1 } } }), lenderBalance(actor.lenderId)]);
  return ok({ lender, balance });
});

/** PATCH /api/lenders/me : profil professionnel et conditions de livraison. */
export const PATCH = route(async ({ req }) => ok(await updateCompany(await requireLender("COMPANY_MANAGE"), await parseBody(req, companyInput))));
