"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api-client";
import { daysBetween, parseDate } from "@/lib/dates";
import { formatFcfa } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { Minus, Plus, ShieldCheck } from "@/components/ui/icons";
import { RangeCalendar, type DayInfo } from "./range-calendar";

type Props = {
  productId: string;
  unitPrice: number;
  deposit: number;
  /** Caution en % de la location (null : caution fixe par unité). */
  depositPercent: number | null;
  stock: number;
  minDays: number;
  maxDays: number | null;
  signedIn: boolean;
  canBook: boolean;
  initialStart?: string;
  initialEnd?: string;
};

export function BookingPanel({ productId, unitPrice, deposit, depositPercent, stock, minDays, maxDays, signedIn, canBook, initialStart, initialEnd }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [start, setStart] = useState<string | null>(initialStart ?? null);
  const [end, setEnd] = useState<string | null>(initialEnd ?? null);
  const [qty, setQty] = useState(1);
  const [avail, setAvail] = useState<Record<string, DayInfo>>({});
  const [busy, setBusy] = useState<"cart" | "now" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const days = start && end ? daysBetween(parseDate(start), parseDate(end)) : 0;
  const maxQty = useMemo(() => {
    if (!start || !end) return stock;
    let min = stock;
    for (let d = parseDate(start); d < parseDate(end); d = new Date(d.getTime() + 86_400_000)) {
      const info = avail[d.toISOString().slice(0, 10)];
      if (info) min = Math.min(min, info.available);
    }
    return Math.max(0, min);
  }, [start, end, avail, stock]);

  const tooLong = maxDays != null && days > maxDays;
  const rental = unitPrice * qty * days;
  const depositTotal = depositPercent != null ? Math.round((rental * depositPercent) / 100) : deposit * qty;
  const total = rental + depositTotal;

  async function add(go: boolean) {
    setError(null);
    if (!signedIn) {
      router.push(`/connexion?next=${encodeURIComponent(location.pathname + location.search)}`);
      return;
    }
    if (!start || !end) return setError("Choisissez les dates de début et de retour.");
    if (tooLong) return setError(`La durée maximale est de ${maxDays} jours.`);
    if (qty > maxQty) return setError(`Seulement ${maxQty} disponible${maxQty > 1 ? "s" : ""} sur cette période.`);
    setBusy(go ? "now" : "cart");
    try {
      await api("/api/cart/items", { body: { productId, quantity: qty, startDate: start, endDate: end } });
      if (go) router.push("/panier");
      else {
        toast({ tone: "success", title: "Ajouté au panier", description: "Vous pouvez continuer vos recherches ou passer à la réservation." });
        router.refresh();
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Impossible d'ajouter ce produit.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="p-5 lg:sticky lg:top-24">
      <h2 className="text-lg font-semibold text-ink">Réserver ce produit</h2>
      <p className="mt-1 text-sm text-muted">
        <span className="text-xl font-semibold tabular-nums text-ink">{formatFcfa(unitPrice)}</span> par jour
      </p>

      <div className="mt-5">
        <RangeCalendar productId={productId} start={start} end={end} minDays={minDays} months={1} onChange={(s, e) => { setStart(s); setEnd(e); setError(null); }} onAvailability={setAvail} />
      </div>

      <div className="mt-5 flex items-center justify-between rounded-control border border-line px-3 py-2">
        <div>
          <p className="text-sm font-medium text-ink">Quantité</p>
          <p className="text-xs text-muted">{start && end ? `${maxQty} disponible${maxQty > 1 ? "s" : ""} sur la période` : `${stock} en stock`}</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setQty(Math.max(1, qty - 1))} className="flex size-10 items-center justify-center rounded-control border border-line hover:bg-surface-2" aria-label="Diminuer la quantité">
            <Minus size={16} />
          </button>
          <input aria-label="Quantité" inputMode="numeric" value={qty} onChange={(e) => setQty(Math.max(1, Math.min(10_000, Number(e.target.value.replace(/\D/g, "")) || 1)))} className="h-10 w-14 rounded-control border border-line bg-surface text-center tabular-nums text-ink" />
          <button type="button" onClick={() => setQty(Math.min(Math.max(maxQty, 1), qty + 1))} className="flex size-10 items-center justify-center rounded-control border border-line hover:bg-surface-2" aria-label="Augmenter la quantité">
            <Plus size={16} />
          </button>
        </div>
      </div>

      <dl className="mt-5 space-y-2 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted">{days > 0 ? `${days} jour${days > 1 ? "s" : ""} x ${qty}` : "Location"}</dt>
          <dd className="tabular-nums text-ink">{days > 0 ? formatFcfa(rental) : "À calculer"}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="flex items-center gap-1.5 text-muted"><ShieldCheck size={16} /> Caution{depositPercent != null ? ` (${depositPercent} %)` : ""}, restituée au retour</dt>
          <dd className="tabular-nums text-ink">{depositPercent != null && days === 0 ? "À calculer" : formatFcfa(depositTotal)}</dd>
        </div>
        <div className="flex justify-between border-t border-line pt-3 text-base font-semibold">
          <dt className="text-ink">Total à payer</dt>
          <dd className="tabular-nums text-ink">{days > 0 ? formatFcfa(total) : depositPercent != null ? "À calculer" : formatFcfa(depositTotal)}</dd>
        </div>
      </dl>
      <p className="mt-2 text-xs text-muted">Les montants sont recalculés par le serveur au moment de la réservation.</p>

      {error && (
        <div className="mt-4" role="alert">
          <Notice tone="danger">{error}</Notice>
        </div>
      )}
      {!canBook && signedIn && (
        <div className="mt-4">
          <Notice tone="info">Les comptes loueur et administrateur ne peuvent pas réserver. Utilisez un compte client.</Notice>
        </div>
      )}

      <div className="mt-5 grid gap-2">
        <Button size="lg" onClick={() => add(true)} loading={busy === "now"} disabled={!canBook && signedIn}>
          Réserver maintenant
        </Button>
        <Button size="lg" variant="secondary" onClick={() => add(false)} loading={busy === "cart"} disabled={!canBook && signedIn}>
          Ajouter au panier
        </Button>
      </div>
      {!signedIn && (
        <p className="mt-3 text-center text-sm text-muted">
          <Link href={`/connexion?next=${encodeURIComponent(`/produits`)}`} className="font-medium text-royal-ink underline-offset-2 hover:underline">Connectez-vous</Link> pour réserver.
        </p>
      )}
    </Card>
  );
}
