import { z } from "zod";
import { created, parseBody, route } from "@/lib/http/route";
import { requireClient } from "@/lib/auth/actor";
import { contestReport } from "@/services/returns";

/** POST .../contest : contestation dans la fenêtre. La caution est gelée et un litige ciblé est ouvert. */
export const POST = route<{ id: string }>(async ({ req, params }) => {
  const { reason } = await parseBody(req, z.object({ reason: z.string().trim().min(10).max(1500) }));
  return created(await contestReport(await requireClient(), params.id, reason));
});
