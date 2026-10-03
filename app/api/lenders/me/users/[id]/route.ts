import { ok, parseBody, route } from "@/lib/http/route";
import { db } from "@/lib/db";
import { notFound } from "@/lib/errors";
import { requireLender } from "@/lib/auth/actor";
import { memberPatch, updateMember } from "@/services/lenders";

/** GET /api/lenders/me/users/:id : détail d'un sous-compte. */
export const GET = route<{ id: string }>(async ({ params }) => {
  const actor = await requireLender("TEAM_MANAGE");
  const member = await db.lenderMember.findFirst({ where: { id: params.id, lenderId: actor.lenderId }, include: { user: { select: { firstName: true, lastName: true, email: true, phone: true, lastLoginAt: true } }, role: true } });
  if (!member) throw notFound("Sous-compte");
  return ok(member);
});

/** PATCH /api/lenders/me/users/:id : rôle, identité, suspension. */
export const PATCH = route<{ id: string }>(async ({ req, params }) => ok(await updateMember(await requireLender("TEAM_MANAGE"), params.id, await parseBody(req, memberPatch))));
