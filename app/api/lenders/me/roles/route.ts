import { created, ok, parseBody, route } from "@/lib/http/route";
import { requireLender } from "@/lib/auth/actor";
import { createRole, listRoles, roleInput } from "@/services/lenders";

/** GET /api/lenders/me/roles : rôles système et personnalisés disponibles. */
export const GET = route(async () => ok(await listRoles((await requireLender("TEAM_MANAGE")).lenderId)));

/** POST /api/lenders/me/roles : crée un rôle personnalisé depuis le catalogue de permissions. */
export const POST = route(async ({ req }) => created(await createRole(await requireLender("TEAM_MANAGE"), await parseBody(req, roleInput))));
