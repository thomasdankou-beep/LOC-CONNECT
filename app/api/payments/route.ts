import { created, parseBody, route } from "@/lib/http/route";
import { requireActor } from "@/lib/auth/actor";
import { initiatePayment, paymentInput } from "@/services/payments";

/**
 * POST /api/payments : initie le paiement unique d'une réservation (ou d'un complément de dommages).
 * Le montant est calculé par le serveur. La clé d'idempotence évite tout double paiement.
 * Avec le fournisseur "simulated", aucun argent réel n'est déplacé : la réponse porte `simulated: true`.
 */
export const POST = route(async ({ req }) => {
  const actor = await requireActor();
  const result = await initiatePayment(actor, await parseBody(req, paymentInput));
  return created({ payment: result.payment, simulated: result.simulated, replayed: result.replayed });
});
