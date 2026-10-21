import { ok, route } from "@/lib/http/route";
import { requireAdmin } from "@/lib/auth/actor";
import { listValidations } from "@/services/admin";

/** GET /api/admin/validations : actions nécessitant une validation renforcée (ex. coordonnées de versement). */
export const GET = route(async () => ok(await listValidations(await requireAdmin())));
