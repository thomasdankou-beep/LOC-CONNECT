import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

/**
 * Fournisseur de paiement. Seul le fournisseur "simulated" est fourni : il ne déplace aucun argent réel.
 * Pour brancher Orange Money, MTN, Moov, Wave ou une passerelle carte, implémenter cette interface
 * (création de la charge, vérification de signature du webhook) et l'enregistrer dans `providers`.
 */
export interface PaymentProvider {
  readonly name: string;
  readonly simulated: boolean;
  createCharge(input: { reference: string; amount: number; currency: string; method: string }): Promise<{ providerRef: string; redirectUrl?: string }>;
  verifySignature(rawBody: string, signature: string | null): boolean;
}

export const signPayload = (rawBody: string): string => createHmac("sha256", env().PAYMENT_WEBHOOK_SECRET).update(rawBody).digest("hex");

class SimulatedProvider implements PaymentProvider {
  readonly name = "simulated";
  readonly simulated = true;

  async createCharge(input: { reference: string }) {
    return { providerRef: `SIM-${input.reference}` };
  }

  verifySignature(rawBody: string, signature: string | null): boolean {
    if (!signature) return false;
    const expected = Buffer.from(signPayload(rawBody), "hex");
    let given: Buffer;
    try {
      given = Buffer.from(signature, "hex");
    } catch {
      return false;
    }
    return given.length === expected.length && timingSafeEqual(given, expected);
  }
}

const providers: Record<string, PaymentProvider> = { simulated: new SimulatedProvider() };

export function getProvider(name = env().PAYMENT_PROVIDER): PaymentProvider {
  const p = providers[name];
  if (!p) throw new Error(`Fournisseur de paiement inconnu: ${name}`);
  return p;
}

export type WebhookEventPayload = {
  id: string;
  type: "payment.succeeded" | "payment.failed";
  data: { reference: string; providerRef?: string; amount: number; currency?: string; failureReason?: string };
};
