"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { eventDeliveryWindow } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { SLOTS, slotLabel } from "@/lib/slots";
import { Input, Select } from "@/components/ui/field";
import { api, ApiError } from "@/lib/api-client";

export function DeliveryPriceForm({ quoteId, outDate, backDate, eventDate, preferredOut, preferredBack }: { quoteId: string; outDate: string; backDate: string; eventDate?: string; preferredOut?: string | null; preferredBack?: string | null }) {
  const window = eventDate ? eventDeliveryWindow(eventDate) : undefined;
  const latestDelivery = window && window.lastDelivery < outDate ? window.lastDelivery : outDate;
  const earliestRecovery = window && window.firstRecovery > backDate ? window.firstRecovery : backDate;
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const fields = new FormData(event.currentTarget);
    const amount = Number(fields.get("amount"));
    setPending(true);
    setError(null);
    try {
      await api(`/api/quotes/${quoteId}/delivery-price`, { body: { amount, deliverySlot: fields.get("deliverySlot"), returnSlot: fields.get("returnSlot"), deliveryDate: fields.get("deliveryDate"), returnDate: fields.get("returnDate") } });
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de confirmer le tarif.");
      setPending(false);
    }
  }

  return (
    <form onSubmit={confirm} className="mt-3 space-y-2">
      <Input label="Livraison et récupération (F CFA)" name="amount" type="number" min={0} max={1000000} step={1} required disabled={pending} />
      <Input label="Jour de livraison" name="deliveryDate" type="date" defaultValue={latestDelivery} min={window?.firstDelivery} max={latestDelivery} required disabled={pending}
        hint="La date doit couvrir le début de la location." />
      <Input label="Jour de récupération" name="returnDate" type="date" defaultValue={earliestRecovery} min={earliestRecovery} max={window?.lastRecovery} required disabled={pending} />
      <p className="text-sm text-muted">Les créneaux sont en heure locale du lieu de livraison.</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <Select label="Tranche horaire de livraison" name="deliverySlot" defaultValue={preferredOut ?? ""} required disabled={pending}>
          <option value="">Choisir un créneau</option>
          {SLOTS.map((slot) => <option key={slot} value={slot}>{slotLabel(slot)}</option>)}
        </Select>
        <Select label="Tranche horaire de récupération" name="returnSlot" defaultValue={preferredBack ?? ""} required disabled={pending}>
          <option value="">Choisir un créneau</option>
          {SLOTS.map((slot) => <option key={slot} value={slot}>{slotLabel(slot)}</option>)}
        </Select>
      </div>
      <Button type="submit" loading={pending} disabled={pending}>Confirmer la date, les horaires et le tarif</Button>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </form>
  );
}
