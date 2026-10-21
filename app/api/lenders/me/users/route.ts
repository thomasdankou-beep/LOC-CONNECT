import { created, ok, parseBody, route } from "@/lib/http/route";
import { requireLender } from "@/lib/auth/actor";
import { createMember, listMembers, memberInput } from "@/services/lenders";

/** GET /api/lenders/me/users : sous-comptes de l'entreprise. */
export const GET = route(async () => ok(await listMembers((await requireLender("TEAM_MANAGE")).lenderId)));

/** POST /api/lenders/me/users : crée un sous-compte rattaché exclusivement à cette entreprise (mot de passe provisoire affiché une fois). */
export const POST = route(async ({ req }) => {
  const actor = await requireLender("TEAM_MANAGE");
  const { member, temporaryPassword } = await createMember(actor, await parseBody(req, memberInput));
  return created({ member, temporaryPassword });
});
