import { ok, parseBody, route } from "@/lib/http/route";
import { requireLender } from "@/lib/auth/actor";
import { paymentModeInput, setPaymentMode } from "@/services/lenders";

/** PUT /api/lenders/me/payment-mode : tout en ligne, ou acompte en ligne et solde en espèces (si ouvert par l'administration). */
export const PUT = route(async ({ req }) => ok(await setPaymentMode(await requireLender(), await parseBody(req, paymentModeInput))));
