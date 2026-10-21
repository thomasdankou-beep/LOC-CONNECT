import { ok, route } from "@/lib/http/route";
import { requireActor } from "@/lib/auth/actor";
import { previewCancellation } from "@/services/refunds";

/** GET /api/reservations/:id/cancellation-preview?itemIds=a,b : montant remboursable avant confirmation. */
export const GET = route<{ id: string }>(async ({ req, params }) => {
  const actor = await requireActor();
  const ids = req.nextUrl.searchParams.get("itemIds");
  return ok(await previewCancellation(actor, params.id, { itemIds: ids ? ids.split(",") : undefined }));
});
