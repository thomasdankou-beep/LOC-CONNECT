import { z } from "zod";
import { ok, parseBody, route } from "@/lib/http/route";
import { requireLender } from "@/lib/auth/actor";
import { assignRole } from "@/services/lenders";

/** PUT /api/lenders/me/users/:id/roles : attribue un rôle (système ou personnalisé) au sous-compte. */
export const PUT = route<{ id: string }>(async ({ req, params }) => {
  const { roleId } = await parseBody(req, z.object({ roleId: z.string().min(1) }));
  return ok(await assignRole(await requireLender("TEAM_MANAGE"), params.id, roleId));
});
