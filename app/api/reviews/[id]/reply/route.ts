import { ok, parseBody, route } from "@/lib/http/route";
import { requireLender } from "@/lib/auth/actor";
import { replyInput, replyToReview } from "@/services/reviews";

/** POST /api/reviews/:id/reply : réponse publique du loueur à un avis. */
export const POST = route<{ id: string }>(async ({ req, params }) => {
  const actor = await requireLender("REVIEW_REPLY");
  const { reply } = await parseBody(req, replyInput);
  return ok(await replyToReview(actor, params.id, reply));
});
