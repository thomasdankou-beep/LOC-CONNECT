import { ok, parseQuery, route } from "@/lib/http/route";
import { requireLender } from "@/lib/auth/actor";
import { auditQuery, listLenderAudit } from "@/services/lenders";

/** GET /api/lenders/me/audit : audit de l'entreprise, filtrable par utilisateur, action, entité et période. */
export const GET = route(async ({ req }) => ok(await listLenderAudit(await requireLender("AUDIT_VIEW"), parseQuery(req, auditQuery))));
