import { requireLender } from "@/lib/auth/actor";
import { ok, parseBody, route } from "@/lib/http/route";
import { handoverSignatureInput, signHandover } from "@/services/handover-signatures";

export const POST = route<{ id: string }>(async ({ req, params }) => {
  const actor = await requireLender("ORDER_VIEW");
  const signature = await signHandover(actor, params.id, await parseBody(req, handoverSignatureInput));
  return ok({ id: signature.id });
});
