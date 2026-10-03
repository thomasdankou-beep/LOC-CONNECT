import { ok, parseBody, route } from "@/lib/http/route";
import { requireLender } from "@/lib/auth/actor";
import { roleInput, updateRole } from "@/services/lenders";

/** PATCH /api/lenders/me/roles/:id : modifie un rôle personnalisé (les rôles système sont en lecture seule). */
export const PATCH = route<{ id: string }>(async ({ req, params }) => ok(await updateRole(await requireLender("TEAM_MANAGE"), params.id, await parseBody(req, roleInput.partial()))));
