import { z } from "zod";
import { ok, parseBody, route } from "@/lib/http/route";
import { requireAdmin } from "@/lib/auth/actor";
import { getSettingsForAdmin, updateSetting } from "@/services/admin";

/** GET /api/admin/settings : paramètres commerciaux configurables (aucun n'est codé en dur). */
export const GET = route(async () => ok(await getSettingsForAdmin(await requireAdmin())));

/** PATCH /api/admin/settings : modifie un paramètre (audité, effet immédiat sur les nouvelles opérations). */
export const PATCH = route(async ({ req }) => {
  const actor = await requireAdmin("ADMIN_SETTINGS");
  const { key, value } = await parseBody(req, z.object({ key: z.string(), value: z.union([z.string(), z.number(), z.boolean()]) }));
  await updateSetting(actor, key, value);
  return ok({ updated: key });
});
