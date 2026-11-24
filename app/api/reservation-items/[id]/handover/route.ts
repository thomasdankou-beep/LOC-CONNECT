import { requireLender } from "@/lib/auth/actor";
import { ok, parseBody, route } from "@/lib/http/route";
import { handoverInput } from "@/lib/material-check";
import { recordHandover } from "@/services/handover";

export const POST = route<{ id: string }>(async ({ req, params }) => {
  const actor = await requireLender("ORDER_VIEW");
  return ok(await recordHandover(actor, params.id, await parseBody(req, handoverInput)));
});
