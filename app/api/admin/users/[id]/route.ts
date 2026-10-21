import { z } from "zod";
import { ok, parseBody, route } from "@/lib/http/route";
import { requireAdmin } from "@/lib/auth/actor";
import { assignAdminRole, setUserStatus } from "@/services/admin";

/** PATCH /api/admin/users/:id : suspendre, réactiver, désactiver (sessions révoquées) ou attribuer un rôle plateforme. */
export const PATCH = route<{ id: string }>(async ({ req, params }) => {
  const actor = await requireAdmin();
  const body = await parseBody(req, z.union([z.object({ status: z.enum(["ACTIVE", "SUSPENDED", "DEACTIVATED"]), reason: z.string().trim().max(300).optional() }), z.object({ role: z.string(), grant: z.boolean() })]));
  if ("status" in body) return ok(await setUserStatus(actor, params.id, body.status, body.reason));
  await assignAdminRole(actor, params.id, body.role, body.grant);
  return ok({ updated: true });
});
