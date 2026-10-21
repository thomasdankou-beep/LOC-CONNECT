import { created, parseBody, route } from "@/lib/http/route";
import { requireAdmin } from "@/lib/auth/actor";
import { adminRefund, adminRefundInput } from "@/services/refunds";

/** POST /api/payments/:id/refunds : remboursement exceptionnel (administration finance), plafonné par le paiement. */
export const POST = route<{ id: string }>(async ({ req, params }) => created(await adminRefund(await requireAdmin("ADMIN_REFUNDS"), params.id, await parseBody(req, adminRefundInput))));
