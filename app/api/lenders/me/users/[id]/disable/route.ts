import { ok, route } from "@/lib/http/route";
import { requireLender } from "@/lib/auth/actor";
import { disableMember } from "@/services/lenders";

/** POST /api/lenders/me/users/:id/disable : désactive le sous-compte et révoque ses sessions (historique conservé). */
export const POST = route<{ id: string }>(async ({ params }) => ok(await disableMember(await requireLender("TEAM_MANAGE"), params.id)));
