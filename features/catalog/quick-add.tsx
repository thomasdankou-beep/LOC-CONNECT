"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { ShoppingCart } from "@/components/ui/icons";
import { toISODate, addDays, todayUTC } from "@/lib/dates";

/** Ajout rapide au panier depuis une carte produit : dates et quantité dans une boîte de dialogue. */
export function QuickAdd({ productId, name, start, end, stock, signedIn }: { productId: string; name: string; start?: string; end?: string; stock: number; signedIn: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const min = toISODate(todayUTC());

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setPending(true);
    setError(null);
    try {
      await api("/api/cart/items", { body: { productId, quantity: Number(fd.get("quantity")), startDate: fd.get("start"), endDate: fd.get("end") } });
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
        onClick={() => (signedIn ? setOpen(true) : router.push(`/connexion?next=${encodeURIComponent(location.pathname + location.search)}`))}
      >
        <ShoppingCart size={16} /> Ajouter
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Ajouter au panier" description={name} size="sm">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <Input name="start" label="Début" type="date" min={min} defaultValue={start} required />
            <Input name="end" label="Retour" type="date" min={min} defaultValue={end ?? toISODate(addDays(todayUTC(), 2))} required />
          </div>
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
