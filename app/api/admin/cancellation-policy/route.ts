import { ok, parseBody, route } from "@/lib/http/route";
import { requireAdmin } from "@/lib/auth/actor";
import { cancellationPolicyInput, getCancellationPolicy, saveCancellationPolicy } from "@/services/admin";

/** GET /api/admin/cancellation-policy : paliers de remboursement en vigueur. */
export const GET = route(async () => ok(await getCancellationPolicy(await requireAdmin())));

/** PUT /api/admin/cancellation-policy : remplace les paliers (délai minimal avant le début, pourcentage remboursé). */
export const PUT = route(async ({ req }) => ok(await saveCancellationPolicy(await requireAdmin(), await parseBody(req, cancellationPolicyInput))));
