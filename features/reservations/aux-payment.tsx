"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { api, ApiError, newIdempotencyKey } from "@/lib/api-client";
import { formatFcfa } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Notice } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";

const METHODS = [
  { value: "ORANGE_MONEY", label: "Orange Money" },
  { value: "MTN_MONEY", label: "MTN Money" },
  { value: "MOOV_MONEY", label: "Moov Money" },
  { value: "WAVE", label: "Wave" },
  { value: "CARD", label: "Carte bancaire" },
] as const;

/**
 * Règlement d'un montant complémentaire (dommages au-delà de la caution, complément de modification).
 * Même circuit que le paiement initial : création du paiement puis webhook signé (simulé en démonstration).
 */
export function AuxPaymentButton({ label, title, amount, endpoint, body, variant = "primary" }: { label: string; title: string; amount: number; endpoint: string; body: Record<string, unknown>; variant?: "primary" | "secondary" }) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<(typeof METHODS)[number]["value"]>("ORANGE_MONEY");
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const key = useRef(newIdempotencyKey());

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ payment?: { id: string }; id?: string }>(endpoint, { body: { ...body, method, idempotencyKey: key.current } });
      setPaymentId(res.payment?.id ?? res.id ?? null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Le paiement n'a pas pu être initié.");
    } finally {
      setBusy(false);
    }
  }

  async function simulate(outcome: "success" | "failure") {
    if (!paymentId) return;
    setBusy(true);
    try {
      await api(`/api/payments/${paymentId}/simulate`, { body: { outcome } });
      if (outcome === "success") {
        toast({ tone: "success", title: "Paiement confirmé", description: "Paiement simulé : aucun argent réel n'a été prélevé." });
        setOpen(false);
        router.refresh();
      } else {
        key.current = newIdempotencyKey();
        setPaymentId(null);
        setError("Paiement échoué (échec simulé). Réessayez.");
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Erreur lors de la confirmation.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button size="sm" variant={variant} onClick={() => setOpen(true)}>{label}</Button>
      <Modal open={open} onClose={() => setOpen(false)} title={title} description={`Montant à régler : ${formatFcfa(amount)}`} size="md">
        <div className="space-y-4">
          <Notice tone="warning" title="Paiement de démonstration">Aucun argent réel n&apos;est prélevé.</Notice>
          {error && <div role="alert"><Notice tone="danger">{error}</Notice></div>}
          {!paymentId ? (
            <>
              <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Moyen de paiement">
                {METHODS.map((m) => (
                  <label key={m.value} className={cn("flex cursor-pointer items-center gap-2.5 rounded-control border px-3 py-3 text-sm transition", method === m.value ? "border-royal bg-royal-soft" : "border-line hover:bg-surface-2")}>
                    <input type="radio" name="aux-method" checked={method === m.value} onChange={() => setMethod(m.value)} className="size-4 accent-[var(--lc-royal)]" />
                    {m.label}
                  </label>
                ))}
              </div>
              <Button size="lg" className="w-full" loading={busy} onClick={create}>Payer {formatFcfa(amount)}</Button>
            </>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted">Choisissez le résultat à simuler pour la passerelle de paiement.</p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button size="lg" className="flex-1" loading={busy} onClick={() => simulate("success")}>Simuler un paiement réussi</Button>
                <Button size="lg" variant="secondary" className="flex-1" disabled={busy} onClick={() => simulate("failure")}>Simuler un échec</Button>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
