"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { ShoppingCart } from "@/components/ui/icons";
import { daysBetween, formatRentalPeriod, parseDate } from "@/lib/dates";
import { RangeCalendar } from "./range-calendar";

/** Ajout rapide au panier depuis une carte produit : dates et quantité dans une boîte de dialogue. */
export function QuickAdd({ productId, name, start, end, stock, signedIn, minDays, maxDays, returnBufferDays }: { productId: string; name: string; start?: string; end?: string; stock: number; signedIn: boolean; minDays: number; maxDays: number | null; returnBufferDays: number }) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [selectedStart, setSelectedStart] = useState<string | null>(start ?? null);
  const [selectedEnd, setSelectedEnd] = useState<string | null>(end ?? null);

  function openModal() {
    setSelectedStart(start ?? null);
    setSelectedEnd(end ?? null);
    setError(null);
    setOpen(true);
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedStart || !selectedEnd) {
      setError("Sélectionnez le ou les jours de location.");
      return;
    }
    const duration = daysBetween(parseDate(selectedStart), parseDate(selectedEnd));
    if (duration < minDays || (maxDays !== null && duration > maxDays)) {
      setError(duration < minDays ? `La durée minimale est de ${minDays} jours.` : `La durée maximale est de ${maxDays} jours.`);
      return;
    }
    const fd = new FormData(e.currentTarget);
    setPending(true);
    setError(null);
    try {
      await api("/api/cart/items", { body: { productId, quantity: Number(fd.get("quantity")), startDate: selectedStart, endDate: selectedEnd } });
      toast({ tone: "success", title: "Ajouté au panier", description: name });
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible d'ajouter ce produit.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        className="flex-1"
        onClick={() => (signedIn ? openModal() : router.push(`/connexion?next=${encodeURIComponent(location.pathname + location.search)}`))}
      >
        <ShoppingCart size={16} /> Ajouter
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Ajouter au panier" description={name} size="sm">
        <form onSubmit={submit} className="flex flex-col gap-4">
          {open && (
            <RangeCalendar
              productId={productId}
              start={selectedStart}
              end={selectedEnd}
              minDays={minDays}
              maxDays={maxDays}
              returnBufferDays={returnBufferDays}
              months={1}
              onChange={(first, exclusiveEnd) => {
                setSelectedStart(first);
                setSelectedEnd(exclusiveEnd);
                setError(null);
              }}
            />
          )}
          {selectedStart && selectedEnd && (
            <p className="text-sm font-medium" aria-live="polite">{formatRentalPeriod(selectedStart, selectedEnd)}</p>
          )}
          <Input name="quantity" label="Quantité" type="number" min={1} max={stock} defaultValue={1} required />
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" loading={pending}>
              Ajouter au panier
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
