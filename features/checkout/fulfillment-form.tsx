"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { api, ApiError } from "@/lib/api-client";
import { formatFcfa } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Checkbox, Input, Select } from "@/components/ui/field";
import { Notice } from "@/components/ui/states";
import { Storefront, Truck } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { SCHEDULE_LABELS, SLOTS, slotLabel } from "@/lib/slots";

type LenderTerms = { lenderId: string; name: string; cityId: string; offersDelivery: boolean; feeLocal: number; feeRemote: number; terms: string | null; deliveryRequired: boolean };
type City = { id: string; name: string };

export function FulfillmentForm({ lenders, cities, defaults, schedule }: { lenders: LenderTerms[]; cities: City[]; defaults: { address: string; cityId: string; phone: string }; schedule: { outDate: string; backDate: string } }) {
  const router = useRouter();
  const canDeliver = lenders.every((l) => l.offersDelivery);
  const mustDeliver = lenders.filter((l) => l.deliveryRequired);
  const [mode, setMode] = useState<"PICKUP" | "DELIVERY">(mustDeliver.length > 0 && canDeliver ? "DELIVERY" : "PICKUP");
  const [cityId, setCityId] = useState(defaults.cityId);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<"pay" | "quote" | null>(null);
  const [accepted, setAccepted] = useState(false);

  const estimates = useMemo(
    () => lenders.map((l) => ({ ...l, fee: mode === "DELIVERY" && l.offersDelivery ? (cityId && cityId === l.cityId ? l.feeLocal : l.feeRemote) : 0 })),
    [lenders, mode, cityId],
  );
  const total = estimates.reduce((a, e) => a + e.fee, 0);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // Le bouton « Obtenir une proforma » envoie le même formulaire : la proforma ne bloque pas le stock.
    const intent = (e.nativeEvent as SubmitEvent).submitter?.getAttribute("value") === "quote" ? "quote" : "pay";
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
      deliverySlot: String(fd.get("deliverySlot") ?? "") || undefined,
      returnSlot: String(fd.get("returnSlot") ?? "") || undefined,
      eventName: String(fd.get("eventName") ?? "").trim() || undefined,
    };
    try {
      if (intent === "quote") {
        const quote = await api<{ id: string }>("/api/quotes", { body });
        router.push(`/proformas/${quote.id}`);
        return;
      }
      const hold = await api<{ id: string }>("/api/holds", { body: { ...body, acceptTerms: true, replaceExisting: true } });
      router.push(`/paiement?hold=${hold.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : intent === "quote" ? "Impossible de préparer la proforma pour le moment." : "Impossible de bloquer le stock pour le moment.");
      setPending(null);
    }
  }

  const labels = SCHEDULE_LABELS[mode];
  const day = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

  const options = [
    { value: "PICKUP" as const, icon: <Storefront size={22} />, title: "Retrait chez le loueur", desc: mustDeliver.length ? `Indisponible : ${mustDeliver.map((l) => l.name).join(", ")} livre obligatoirement son matériel.` : "Gratuit. Vous récupérez et rapportez le matériel.", disabled: mustDeliver.length > 0 },
    { value: "DELIVERY" as const, icon: <Truck size={22} />, title: "Livraison", desc: canDeliver ? "Le loueur livre à l'adresse de votre choix. Frais selon la ville." : "Indisponible : un loueur du panier ne livre pas.", disabled: !canDeliver },
  ];

  return (
    <form onSubmit={submit} className="space-y-8">
      <fieldset>
        <legend className="text-lg font-semibold text-ink">Mode de remise</legend>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {options.map((o) => (
            <label key={o.value} className={cn("flex cursor-pointer items-start gap-3.5 rounded-card border p-4 transition", mode === o.value ? "border-royal bg-royal-soft" : "border-line bg-surface hover:bg-surface-2", o.disabled && "cursor-not-allowed opacity-50")}>
              <input type="radio" name="mode" value={o.value} checked={mode === o.value} disabled={o.disabled} onChange={() => setMode(o.value)} className="mt-1 size-4 accent-[var(--lc-royal)]" />
              <span>
                <span className="flex items-center gap-2 font-semibold text-ink">{o.icon} {o.title}</span>
                <span className="mt-1 block text-sm text-muted">{o.desc}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

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
                <span className="tabular-nums text-ink">{e.offersDelivery ? formatFcfa(e.fee) : "Ne livre pas"}</span>
              </li>
            ))}
            <li className="flex justify-between border-t border-line pt-1.5 font-medium">
              <span className="text-ink">Frais de livraison estimés</span>
              <span className="tabular-nums text-ink">{formatFcfa(total)}</span>
            </li>
          </ul>
        </fieldset>
      )}

      <fieldset>
        <legend className="text-lg font-semibold text-ink">Créneaux</legend>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Select label={`${labels.out} le ${day(schedule.outDate)}`} name="deliverySlot" defaultValue="">
            <option value="">À convenir avec le loueur</option>
            {SLOTS.map((s) => <option key={s} value={s}>{slotLabel(s)}</option>)}
          </Select>
          <Select label={`${labels.back} le ${day(schedule.backDate)}`} name="returnSlot" defaultValue="">
            <option value="">À convenir avec le loueur</option>
            {SLOTS.map((s) => <option key={s} value={s}>{slotLabel(s)}</option>)}
          </Select>
        </div>
      </fieldset>

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
      <Checkbox
        label={<><span className="font-medium">Lu et approuvé</span><span className="block text-muted">J&apos;accepte la commande{lenders.some((l) => l.terms) ? " et les conditions générales des loueurs ci-dessus" : ""}. Cette acceptation en ligne remplace la signature et figure sur les factures.</span></>}
        checked={accepted}
        onChange={(e) => setAccepted(e.target.checked)}
      />

      {error && (
        <div role="alert">
          <Notice tone="danger">{error}</Notice>
        </div>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Button type="submit" value="pay" size="lg" loading={pending === "pay"} disabled={pending !== null} className="w-full sm:w-auto">
          Bloquer le stock et passer au paiement
        </Button>
        <Button type="submit" value="quote" variant="secondary" size="lg" loading={pending === "quote"} disabled={pending !== null} className="w-full sm:w-auto">
          Obtenir une proforma
        </Button>
      </div>
      <p className="text-sm text-muted">Le stock est réservé pour vous pendant quelques minutes, le temps de régler la commande. La proforma chiffre la commande sans bloquer le stock : vous pourrez la payer depuis son lien.</p>
    </form>
  );
}
