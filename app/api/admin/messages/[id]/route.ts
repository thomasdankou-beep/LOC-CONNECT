import { z } from "zod";
import { ok, parseBody, route } from "@/lib/http/route";
import { requireAdmin } from "@/lib/auth/actor";
import { setContactHandled } from "@/services/contact";

/** PATCH /api/admin/messages/:id : marque un message de contact comme traité ou le rouvre. */
export const PATCH = route<{ id: string }>(async ({ req, params }) => {
  const { handled } = await parseBody(req, z.object({ handled: z.boolean() }));
  return ok(await setContactHandled(await requireAdmin("ADMIN_NOTIFICATIONS"), params.id, handled));
});
