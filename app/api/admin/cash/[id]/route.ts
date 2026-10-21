import { ok, parseBody, route } from "@/lib/http/route";
import { requireAdmin } from "@/lib/auth/actor";
import { adminCashAction, adminCashInput } from "@/services/cash";

/** POST /api/admin/cash/:id : support, débloquer la saisie du code ou constater un paiement en espèces. */
export const POST = route<{ id: string }>(async ({ req, params }) => ok(await adminCashAction(await requireAdmin(), params.id, await parseBody(req, adminCashInput))));
