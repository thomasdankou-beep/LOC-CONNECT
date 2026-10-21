"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, ApiError } from "@/lib/api-client";
import { HandCoins } from "@/components/ui/icons";

/** Bloque le stock avec les lignes de la proforma et ouvre le paiement. */
export function PayQuoteButton({ quoteId, label }: { quoteId: string; label: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pay() {
    setPending(true);
    setError(null);
    try {
      const hold = await api<{ id: string }>(`/api/quotes/${quoteId}/pay`, { body: {} });
      router.push(`/paiement?hold=${hold.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de lancer le paiement pour le moment.");
      setPending(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button type="button" onClick={pay} disabled={pending} className="inline-flex h-10 items-center gap-2 rounded-[10px] bg-[#0f7a3d] px-4 text-sm font-medium text-white hover:bg-[#0b6331] disabled:opacity-60">
        <HandCoins size={18} /> {pending ? "Blocage du stock…" : label}
      </button>
      {error && <span role="alert" className="max-w-[60ch] text-right text-sm text-[#b42318]">{error}</span>}
    </span>
  );
}
