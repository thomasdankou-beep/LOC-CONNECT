"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, ApiError } from "@/lib/api-client";
import { addDays, parseDate, toISODate } from "@/lib/dates";
import { formatFcfa } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Checkbox, Input, Select } from "@/components/ui/field";
import { Notice } from "@/components/ui/states";
import { SCHEDULE_LABELS, SLOTS, slotLabel } from "@/lib/slots";

type LenderTerms = { lenderId: string; name: string; address: string | null; outDate: string; backDate: string; cityId: string; offersDelivery: boolean; deliveryOnQuote: boolean; feeLocal: number; feeRemote: number; terms: string | null; deliveryRequired: boolean };
type City = { id: string; name: string };

export function FulfillmentForm({ lenders, cities, defaults, termsVersion }: { lenders: LenderTerms[]; cities: City[]; defaults: { address: string; cityId: string; phone: string }; termsVersion: string }) {
  const router = useRouter();
  const [choices, setChoices] = useState<Record<string, "PICKUP" | "DELIVERY">>({});
  const [cityId, setCityId] = useState(defaults.cityId);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<"pay" | "quote" | null>(null);
  const [accepted, setAccepted] = useState(false);
  const plans = lenders.map((lender) => ({
    ...lender,
    mode: choices[lender.lenderId] ?? (lender.deliveryRequired ? "DELIVERY" : "PICKUP"),
  } as const));
  const deliveries = plans.filter((plan) => plan.mode === "DELIVERY");
  const mode = deliveries.length ? "DELIVERY" : "PICKUP";
  const requiresQuote = deliveries.length > 0;
  const estimates = deliveries.map((lender) => ({ ...lender, fee: cityId === lender.cityId ? lender.feeLocal : lender.feeRemote }));
  const total = estimates.reduce((sum, lender) => sum + lender.fee, 0);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // Le bouton « Obtenir une proforma » envoie le même formulaire : la proforma ne bloque pas le stock.
    const intent = requiresQuote || (e.nativeEvent as SubmitEvent).submitter?.getAttribute("value") === "quote" ? "quote" : "pay";
    const fd = new FormData(e.currentTarget);
    if (intent === "pay" && !accepted) {
      setError("Cochez « Lu et approuvé » pour passer au paiement.");
      return;
    }
    setPending(intent);
    setError(null);
    const body = {
      fulfillmentType: mode,
      deliveryAddress: mode === "DELIVERY" ? String(fd.get("address") ?? "") : undefined,
      deliveryCityId: mode === "DELIVERY" ? cityId || undefined : undefined,
      deliveryZone: mode === "DELIVERY" ? String(fd.get("zone") ?? "") || undefined : undefined,
      contactPhone: String(fd.get("phone") ?? "") || undefined,
      lenderFulfillment: plans.map((plan) => ({
        lenderId: plan.lenderId,
        mode: plan.mode,
        preferredDeliveryDate: plan.mode === "DELIVERY" ? String(fd.get(`date-out-${plan.lenderId}`)) : undefined,
        preferredReturnDate: plan.mode === "DELIVERY" ? String(fd.get(`date-back-${plan.lenderId}`)) : undefined,
        deliverySlot: String(fd.get(`out-${plan.lenderId}`) ?? "") || undefined,
        returnSlot: String(fd.get(`back-${plan.lenderId}`) ?? "") || undefined,
      })),
      eventName: String(fd.get("eventName") ?? "").trim() || undefined,
    };
    try {
      if (intent === "quote") {
        const quote = await api<{ id: string }>("/api/quotes", { body });
        router.push(`/proformas/${quote.id}`);
        return;
      }
      const hold = await api<{ id: string }>("/api/holds", { body: { ...body, acceptTerms: true, termsVersion, replaceExisting: true } });
      router.push(`/paiement?hold=${hold.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : intent === "quote" ? "Impossible de préparer la proforma pour le moment." : "Impossible de bloquer le stock pour le moment.");
      setPending(null);
    }
  }

  const day = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

  return (
    <form onSubmit={submit} className="space-y-8">
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-ink">Remise du matériel</h2>
        {plans.map((plan) => {
          const labels = SCHEDULE_LABELS[plan.mode];
          return (
            <fieldset key={plan.lenderId} className="space-y-3 rounded-card border border-line p-4">
              <legend className="px-1 font-semibold text-ink">{plan.name}</legend>
              {plan.deliveryRequired || !plan.offersDelivery ? (
                <p className="text-sm font-medium">{plan.deliveryRequired ? "Livraison obligatoire" : "Retrait au dépôt"}</p>
              ) : (
                <Select label="Mode de remise" value={plan.mode} onChange={(event) => {
                  const selected = event.target.value as "PICKUP" | "DELIVERY";
                  setChoices((previous) => ({ ...previous, [plan.lenderId]: selected }));
                  setAccepted(false);
                }}>
                  <option value="PICKUP">Retrait au dépôt</option>
                  <option value="DELIVERY">Livraison</option>
                </Select>
              )}
              {plan.mode === "PICKUP" && plan.address && <p className="text-sm text-muted">{plan.address}</p>}
              {plan.mode === "DELIVERY" && <p className="text-sm text-muted">Le loueur confirme les jours, les créneaux et le prix avant le paiement.</p>}
              {plan.mode === "DELIVERY" && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Select label="Jour de livraison souhaité" name={`date-out-${plan.lenderId}`} defaultValue={plan.outDate}>
                    <option value={toISODate(addDays(parseDate(plan.outDate), -1))}>La veille · {day(toISODate(addDays(parseDate(plan.outDate), -1)))}</option>
                    <option value={plan.outDate}>Premier jour · {day(plan.outDate)}</option>
                  </Select>
                  <Select label="Jour de récupération souhaité" name={`date-back-${plan.lenderId}`} defaultValue={plan.backDate}>
                    <option value={toISODate(addDays(parseDate(plan.backDate), -1))}>Dernier jour · {day(toISODate(addDays(parseDate(plan.backDate), -1)))}</option>
                    <option value={plan.backDate}>Le lendemain · {day(plan.backDate)}</option>
                  </Select>
                </div>
              )}
              <div key={plan.mode} className="grid gap-3 sm:grid-cols-2">
                <Select label={plan.mode === "DELIVERY" ? "Tranche de livraison souhaitée" : `${labels.out} le ${day(plan.outDate)}`} name={`out-${plan.lenderId}`} defaultValue="">
                  <option value="">À convenir avec le loueur</option>
                  {SLOTS.map((slot) => <option key={slot} value={slot}>{slotLabel(slot)}</option>)}
                </Select>
                <Select label={plan.mode === "DELIVERY" ? "Tranche de récupération souhaitée" : `${labels.back} le ${day(plan.backDate)}`} name={`back-${plan.lenderId}`} defaultValue="">
                  <option value="">À convenir avec le loueur</option>
                  {SLOTS.map((slot) => <option key={slot} value={slot}>{slotLabel(slot)}</option>)}
                </Select>
              </div>
            </fieldset>
          );
        })}
      </div>

      {mode === "DELIVERY" && (
        <fieldset className="space-y-4">
          <legend className="text-lg font-semibold text-ink">Adresse de livraison</legend>
          <Input label="Adresse" name="address" required defaultValue={defaults.address} placeholder="Rue, repère, immeuble" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Ville" name="city" value={cityId} onChange={(e) => setCityId(e.target.value)} required>
              <option value="">Choisir</option>
              {cities.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
            <Input label="Quartier ou zone" name="zone" placeholder="Ex : Riviera Palmeraie" />
          </div>
          <ul className="space-y-1.5 rounded-control bg-surface-2 p-3 text-sm">
            {estimates.map((e) => (
              <li key={e.lenderId} className="flex justify-between gap-3">
                <span className="text-muted">{e.name}</span>
                <span className="tabular-nums text-ink">{e.deliveryOnQuote ? "Sur devis" : formatFcfa(e.fee)}</span>
              </li>
            ))}
            {!requiresQuote && <li className="flex justify-between border-t border-line pt-1.5 font-medium">
              <span className="text-ink">Frais de livraison estimés</span>
              <span className="tabular-nums text-ink">{formatFcfa(total)}</span>
            </li>}
          </ul>
        </fieldset>
      )}

      <fieldset>
        <legend className="text-lg font-semibold text-ink">Contact</legend>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Input label="Événement ou société (facultatif)" name="eventName" maxLength={120} placeholder="Ex : STORY FOAM, mariage Kouadio" hint="Imprimé sur la proforma et les factures." />
          <Input label="Téléphone de contact" name="phone" type="tel" defaultValue={defaults.phone} placeholder="+225 07 00 00 00 00" hint="Utilisé par les loueurs pour la remise ou la livraison." />
        </div>
      </fieldset>

      {lenders.some((l) => l.terms) && (
        <div className="space-y-2">
          {lenders.filter((l) => l.terms).map((l) => (
            <details key={l.lenderId} className="rounded-control border border-line bg-surface-2/50 px-4 py-3 text-sm">
              <summary className="cursor-pointer font-medium text-ink">Conditions générales de {l.name}</summary>
              <p className="mt-2 max-h-64 overflow-y-auto whitespace-pre-line text-muted">{l.terms}</p>
            </details>
          ))}
        </div>
      )}
      {!requiresQuote && <Checkbox
        label={<><span className="font-medium">Lu et approuvé</span><span className="block text-muted">J&apos;accepte la commande{lenders.some((l) => l.terms) ? " et les conditions générales des loueurs ci-dessus" : ""}. Cette acceptation en ligne remplace la signature et figure sur les factures.</span></>}
        checked={accepted}
        onChange={(e) => setAccepted(e.target.checked)}
      />}

      {error && (
        <div role="alert">
          <Notice tone="danger">{error}</Notice>
        </div>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        {!requiresQuote && <Button type="submit" value="pay" size="lg" loading={pending === "pay"} disabled={pending !== null} className="w-full sm:w-auto">
          Bloquer le stock et passer au paiement
        </Button>}
        <Button type="submit" value="quote" variant="secondary" size="lg" loading={pending === "quote"} disabled={pending !== null} className="w-full sm:w-auto">
          {requiresQuote ? "Demander la confirmation de livraison" : "Obtenir une proforma"}
        </Button>
      </div>
      <p className="text-sm text-muted">Le stock est réservé pour vous pendant quelques minutes, le temps de régler la commande. La proforma chiffre la commande sans bloquer le stock : vous pourrez la payer depuis son lien.</p>
      <p className="text-sm text-muted">Le matériel reste indisponible pour une autre location le jour de sa récupération. Ce jour de retour n&apos;ajoute pas de journée facturée.</p>
    </form>
  );
}
