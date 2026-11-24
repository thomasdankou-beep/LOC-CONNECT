"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { eventDeliveryWindow, addDays, parseDate, toISODate } from "@/lib/dates";
import { formatFcfa } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { SLOTS, slotLabel } from "@/lib/slots";
import { Input, Select } from "@/components/ui/field";
import { api, ApiError } from "@/lib/api-client";

export function DeliveryPriceForm({ quoteId, pickup, outDate, backDate, eventDate, requestedDates, preferredOut, preferredBack, estimatedDeposit, deliveryFee, needsLogistics, depositExcludesTransport }: { quoteId: string; pickup: boolean; outDate: string; backDate: string; eventDate?: string; requestedDates?: { delivery: string; recovery: string }; preferredOut?: string | null; preferredBack?: string | null; estimatedDeposit?: number; deliveryFee: number; needsLogistics: boolean; depositExcludesTransport?: true }) {
  const window = requestedDates ? { firstDelivery: toISODate(addDays(parseDate(outDate), -1)), lastDelivery: outDate, firstRecovery: toISODate(addDays(parseDate(backDate), -1)), lastRecovery: backDate } : eventDate ? eventDeliveryWindow(eventDate) : undefined;
  const latestDelivery = window && window.lastDelivery < outDate ? window.lastDelivery : outDate;
  const earliestRecovery = requestedDates ? window?.firstRecovery : window && window.firstRecovery > backDate ? window.firstRecovery : backDate;
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const fields = new FormData(event.currentTarget);
    const amount = pickup ? 0 : Number(fields.get("amount"));
    setPending(true);
    setError(null);
    try {
      const enteredDeposit = fields.get("depositAmount");
      const depositAmount = enteredDeposit ? Number(enteredDeposit) : undefined;
      const body = needsLogistics
        ? { amount, deliverySlot: fields.get("deliverySlot"), returnSlot: fields.get("returnSlot"), deliveryDate: fields.get("deliveryDate"), returnDate: fields.get("returnDate"), depositAmount }
        : { depositOnly: true, depositAmount };
      await api(`/api/quotes/${quoteId}/delivery-price`, { body });
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de valider la proforma.");
      setPending(false);
    }
  }

  return (
    <form onSubmit={confirm} className="mt-3 space-y-2">
      {estimatedDeposit !== undefined && (
        <Input label="Caution personnalisée (F CFA)" name="depositAmount" type="number" min={0} max={1000000000} step={1} disabled={pending}
          hint={`Caution estimée à ${formatFcfa(estimatedDeposit)}. Laissez vide pour appliquer 30 % ${depositExcludesTransport ? "du montant de la location" : "de la location et du transport pour cette proforma"}.`} />
      )}
      {needsLogistics && <>
        {!pickup && <Input label="Livraison et récupération (F CFA)" name="amount" type="number" min={0} max={1000000} step={1} defaultValue={deliveryFee} required disabled={pending} />}
        <Input label={pickup ? "Jour de retrait au dépôt" : "Jour de livraison"} name="deliveryDate" type="date" defaultValue={requestedDates?.delivery ?? latestDelivery} min={window?.firstDelivery} max={latestDelivery} required disabled={pending}
          hint="La date doit couvrir le début de la location." />
        <Input label={pickup ? "Jour de retour au dépôt" : "Jour de récupération"} name="returnDate" type="date" defaultValue={requestedDates?.recovery ?? earliestRecovery} min={earliestRecovery} max={window?.lastRecovery} required disabled={pending} />
        <p className="text-sm text-muted">Les créneaux sont indiqués en heure locale.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <Select label={pickup ? "Tranche horaire de retrait" : "Tranche horaire de livraison"} name="deliverySlot" defaultValue={preferredOut ?? ""} required disabled={pending}>
            <option value="">Choisir un créneau</option>
            {SLOTS.map((slot) => <option key={slot} value={slot}>{slotLabel(slot)}</option>)}
          </Select>
          <Select label={pickup ? "Tranche horaire de retour" : "Tranche horaire de récupération"} name="returnSlot" defaultValue={preferredBack ?? ""} required disabled={pending}>
            <option value="">Choisir un créneau</option>
            {SLOTS.map((slot) => <option key={slot} value={slot}>{slotLabel(slot)}</option>)}
          </Select>
        </div>
      </>}
      <Button type="submit" loading={pending} disabled={pending}>Valider la proforma</Button>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </form>
  );
}
