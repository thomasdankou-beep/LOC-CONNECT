import { NextResponse } from "next/server";
import { ok, route } from "@/lib/http/route";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { runMaintenance } from "@/services/maintenance";

/** POST /api/cron/maintenance : tâches planifiées (expiration des HOLD, escalades, constats non contestés, e-mails). Authorization: Bearer CRON_SECRET. */
export const POST = route(async ({ req }): Promise<NextResponse> => {
  if (req.headers.get("authorization") !== `Bearer ${env().CRON_SECRET}`) throw new AppError("UNAUTHENTICATED", "Jeton de tâche planifiée invalide.");
  return ok(await runMaintenance());
}, { skipCsrf: true, skipRateLimit: true });
