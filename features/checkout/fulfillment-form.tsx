"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { api, ApiError } from "@/lib/api-client";
import { formatFcfa } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { Notice } from "@/components/ui/states";
import { Storefront, Truck } from "@/components/ui/icons";
import { cn } from "@/lib/cn";

type LenderTerms = { lenderId: string; name: string; cityId: string; offersDelivery: boolean; feeLocal: number; feeRemote: number };
type City = { id: string; name: string };

export function FulfillmentForm({ lenders, cities, defaults }: { lenders: LenderTerms[]; cities: City[]; defaults: { address: string; cityId: string; phone: string } }) {
  const router = useRouter();
  const canDeliver = lenders.every((l) => l.offersDelivery);
  const [mode, setMode] = useState<"PICKUP" | "DELIVERY">("PICKUP");
  const [cityId, setCityId] = useState(defaults.cityId);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const estimates = useMemo(
    () => lenders.map((l) => ({ ...l, fee: mode === "DELIVERY" && l.offersDelivery ? (cityId && cityId === l.cityId ? l.feeLocal : l.feeRemote) : 0 })),
    [lenders, mode, cityId],
  );
  const total = estimates.reduce((a, e) => a + e.fee, 0);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setPending(true);
    setError(null);
    try {
      const hold = await api<{ id: string }>("/api/holds", {
        body: {
          fulfillmentType: mode,
          deliveryAddress: mode === "DELIVERY" ? String(fd.get("address") ?? "") : undefined,
          deliveryCityId: mode === "DELIVERY" ? cityId || undefined : undefined,
          deliveryZone: mode === "DELIVERY" ? String(fd.get("zone") ?? "") || undefined : undefined,
          contactPhone: String(fd.get("phone") ?? "") || undefined,
          replaceExisting: true,
        },
      });
      router.push(`/paiement?hold=${hold.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de bloquer le stock pour le moment.");
      setPending(false);
    }
  }

  const options = [
    { value: "PICKUP" as const, icon: <Storefront size={22} />, title: "Retrait chez le loueur", desc: "Gratuit. Vous récupérez et rapportez le matériel.", disabled: false },
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
        <legend className="text-lg font-semibold text-ink">Contact</legend>
        <div className="mt-4">
          <Input label="Téléphone de contact" name="phone" type="tel" defaultValue={defaults.phone} placeholder="+225 07 00 00 00 00" hint="Utilisé par les loueurs pour la remise ou la livraison." />
        </div>
      </fieldset>

      {error && (
        <div role="alert">
          <Notice tone="danger">{error}</Notice>
        </div>
      )}
      <Button type="submit" size="lg" loading={pending} className="w-full sm:w-auto">
        Bloquer le stock et passer au paiement
      </Button>
      <p className="text-sm text-muted">Le stock est réservé pour vous pendant quelques minutes, le temps de régler la commande.</p>
    </form>
  );
}
