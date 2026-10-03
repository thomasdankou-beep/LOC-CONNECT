import { ok, route } from "@/lib/http/route";
import { requireLender } from "@/lib/auth/actor";
import { deleteUnavailability } from "@/services/lenders";

/** DELETE /api/lenders/me/unavailabilities/:id */
export const DELETE = route<{ id: string }>(async ({ params }) => {
  await deleteUnavailability(await requireLender("CALENDAR_MANAGE"), params.id);
  return ok({ deleted: true });
});
