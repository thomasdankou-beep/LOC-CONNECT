import { ok, route } from "@/lib/http/route";
import { requireClient } from "@/lib/auth/actor";
import { acknowledgeReport } from "@/services/returns";

/** POST .../acknowledge : le client accepte le constat ; la caution est réglée immédiatement. */
export const POST = route<{ id: string }>(async ({ params }) => ok(await acknowledgeReport(await requireClient(), params.id)));
