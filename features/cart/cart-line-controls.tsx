"use client";

import { useState } from "react";
import { useAction } from "@/hooks/use-action";
import { Minus, Plus, Trash } from "@/components/ui/icons";

export function CartLineControls({ itemId, quantity, max }: { itemId: string; quantity: number; max: number }) {
  const { run, pending } = useAction();
  const [qty, setQty] = useState(quantity);

  async function update(next: number) {
    if (next < 1 || next === qty) return;
    const prev = qty;
    setQty(next);
    const res = await run(`/api/cart/items/${itemId}`, { method: "PATCH", body: { quantity: next } });
    if (res === undefined) setQty(prev);
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1.5" aria-busy={pending}>
        <button type="button" onClick={() => update(qty - 1)} disabled={pending || qty <= 1} className="flex size-9 items-center justify-center rounded-control border border-line hover:bg-surface-2 disabled:opacity-40" aria-label="Diminuer la quantité">
          <Minus size={14} />
        </button>
        <span className="w-10 text-center text-sm font-medium tabular-nums" aria-live="polite">{qty}</span>
        <button type="button" onClick={() => update(qty + 1)} disabled={pending || qty >= max} className="flex size-9 items-center justify-center rounded-control border border-line hover:bg-surface-2 disabled:opacity-40" aria-label="Augmenter la quantité">
          <Plus size={14} />
        </button>
      </div>
      <button type="button" onClick={() => run(`/api/cart/items/${itemId}`, { method: "DELETE" }, { success: "Article retiré du panier" })} disabled={pending} className="flex h-9 items-center gap-1.5 rounded-control px-2 text-sm text-muted transition hover:bg-danger-soft hover:text-danger" aria-label="Retirer du panier">
        <Trash size={16} /> <span className="hidden sm:inline">Retirer</span>
      </button>
    </div>
  );
}
