import { NextResponse } from "next/server";
import { ok, route } from "@/lib/http/route";
import { env } from "@/lib/env";
import { handleWebhook } from "@/services/payments";

/**
 * POST /api/payments/webhook : webhook du fournisseur de paiement, source de vérité du résultat.
 * En-tête `x-signature` : HMAC SHA-256 hex du corps brut. Un événement (id) n'est traité qu'une fois.
 */
export const POST = route(async ({ req }): Promise<NextResponse> => {
  const raw = await req.text();
  const provider = req.headers.get("x-provider") ?? env().PAYMENT_PROVIDER;
  return ok(await handleWebhook(provider, raw, req.headers.get("x-signature")));
}, { skipCsrf: true, skipRateLimit: false });
