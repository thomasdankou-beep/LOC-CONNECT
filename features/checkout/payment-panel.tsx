"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { api, ApiError, newIdempotencyKey } from "@/lib/api-client";
import { formatFcfa } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Notice, Skeleton } from "@/components/ui/states";
import { ClockCountdown, CreditCard, HandCoins, ShieldCheck, Wallet } from "@/components/ui/icons";
import { cn } from "@/lib/cn";

type Item = { id: string; productName: string; quantity: number; startDate: string; endDate: string; subtotal: number; depositAmount: number; paymentMode: "ONLINE_FULL" | "DEPOSIT_CASH"; cashDue: number; lender: { id: string; companyName: string } };
type Reservation = {
  id: string;
  reference: string;
  status: string;
  subtotal: number;
  deliveryFee: number;
  depositTotal: number;
  cashTotal: number;
  total: number;
  fulfillmentType: "PICKUP" | "DELIVERY";
  items: Item[];
  deliveries: { lenderId: string; fee: number }[];
  cashSettlements: { lenderId: string; amountDue: number; deliveryDue: number; status: string }[];
};

const METHODS = [
  { value: "ORANGE_MONEY", label: "Orange Money", desc: "Paiement mobile", icon: <Wallet size={22} /> },
  { value: "MTN_MONEY", label: "MTN Money", desc: "Paiement mobile", icon: <Wallet size={22} /> },
  { value: "MOOV_MONEY", label: "Moov Money", desc: "Paiement mobile", icon: <Wallet size={22} /> },
  { value: "WAVE", label: "Wave", desc: "Paiement mobile", icon: <Wallet size={22} /> },
  { value: "CARD", label: "Carte bancaire", desc: "Visa ou Mastercard", icon: <CreditCard size={22} /> },
] as const;

type Phase = "loading" | "choose" | "gateway" | "expired" | "error";

export function PaymentPanel({ holdId, secondsLeft }: { holdId: string; secondsLeft: number }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("loading");
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [method, setMethod] = useState<(typeof METHODS)[number]["value"]>("ORANGE_MONEY");
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [left, setLeft] = useState(secondsLeft);
  const key = useRef(newIdempotencyKey());
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      try {
        const created = await api<{ id: string }>("/api/reservations", { body: { holdId } });
        const detail = await api<Reservation>(`/api/reservations/${created.id}`);
        setReservation(detail);
        setPhase("choose");
      } catch (e) {
        setMessage(e instanceof ApiError ? e.message : "Impossible de préparer la réservation.");
        setPhase(e instanceof ApiError && e.code === "HOLD_EXPIRED" ? "expired" : "error");
      }
    })();
  }, [holdId]);

  useEffect(() => {
    if (phase === "expired" || phase === "error") return;
    const timer = setInterval(() => setLeft((s) => s - 1), 1000);
    return () => clearInterval(timer);
  }, [phase]);

  useEffect(() => {
    if (left <= 0 && phase !== "expired" && phase !== "error") setPhase("expired");
  }, [left, phase]);

  const mm = String(Math.max(0, Math.floor(left / 60))).padStart(2, "0");
  const ss = String(Math.max(0, left % 60)).padStart(2, "0");

  const grouped = useMemo(() => {
    const map = new Map<string, { name: string; items: Item[]; delivery: number; cash: number }>();
    for (const i of reservation?.items ?? []) {
      const g = map.get(i.lender.id) ?? { name: i.lender.companyName, items: [], delivery: reservation?.deliveries.find((d) => d.lenderId === i.lender.id)?.fee ?? 0, cash: reservation?.cashSettlements.find((c) => c.lenderId === i.lender.id && c.status === "PENDING")?.amountDue ?? 0 };
      g.items.push(i);
      map.set(i.lender.id, g);
    }
    return [...map.values()];
  }, [reservation]);

  async function pay() {
    if (!reservation) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await api<{ payment: { id: string }; simulated: boolean }>("/api/payments", { body: { reservationId: reservation.id, method, idempotencyKey: key.current } });
      setPaymentId(res.payment.id);
      setPhase("gateway");
    } catch (e) {
      setMessage(e instanceof ApiError ? e.message : "Le paiement n'a pas pu être initié.");
      if (e instanceof ApiError && e.code === "HOLD_EXPIRED") setPhase("expired");
    } finally {
      setBusy(false);
    }
  }

  async function simulate(outcome: "success" | "failure") {
    if (!paymentId || !reservation) return;
    setBusy(true);
    try {
      await api(`/api/payments/${paymentId}/simulate`, { body: { outcome } });
      if (outcome === "success") {
        router.push(`/confirmation?reservation=${reservation.id}`);
        router.refresh();
        return;
      }
      key.current = newIdempotencyKey();
      setPaymentId(null);
      setPhase("choose");
      setMessage("Le paiement a échoué (échec simulé). Vous pouvez réessayer avec un autre moyen de paiement.");
    } catch (e) {
      setMessage(e instanceof ApiError ? e.message : "Erreur lors de la confirmation du paiement.");
    } finally {
      setBusy(false);
    }
  }

  if (phase === "expired")
    return (
      <Card className="mx-auto max-w-xl p-8 text-center">
        <ClockCountdown size={36} className="mx-auto text-warn" />
        <h2 className="mt-4 text-xl font-semibold text-ink">Le blocage de stock a expiré</h2>
        <p className="mt-2 text-muted">Pour que votre matériel reste disponible, le paiement doit être finalisé dans le délai imparti. Le stock a été libéré.</p>
        <Link href="/panier" className="mt-6 inline-flex h-11 items-center rounded-control bg-royal px-5 text-sm font-medium text-white hover:bg-royal-strong">Retourner au panier</Link>
      </Card>
    );
  if (phase === "error")
    return (
      <div className="mx-auto max-w-xl">
        <Notice tone="danger" title="Impossible de continuer">{message}</Notice>
        <Link href="/panier" className="mt-4 inline-block text-sm font-medium text-royal-ink hover:underline">Retourner au panier</Link>
      </div>
    );
  if (phase === "loading" || !reservation)
    return (
      <div className="grid gap-8 lg:grid-cols-[1fr_24rem]">
        <Skeleton className="h-96 rounded-card" />
        <Skeleton className="h-72 rounded-card" />
      </div>
    );

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_24rem]">
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4 rounded-card border border-line bg-surface px-5 py-3.5 shadow-card" role="timer" aria-live="off">
          <p className="flex items-center gap-2 text-sm text-ink"><ClockCountdown size={20} className="text-royal-ink" /> Votre stock est bloqué pendant</p>
          <p className={cn("text-xl font-semibold tabular-nums", left < 120 ? "text-danger" : "text-ink")}>{mm}:{ss}</p>
        </div>

        <Notice tone="warning" title="Paiement de démonstration">
          Ce site utilise un paiement simulé. Aucun argent réel n&apos;est prélevé et aucune donnée bancaire n&apos;est demandée.
        </Notice>

        {message && <div role="alert"><Notice tone="danger">{message}</Notice></div>}

        {phase === "choose" ? (
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-ink">Moyen de paiement</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Moyen de paiement">
              {METHODS.map((m) => (
                <label key={m.value} className={cn("flex cursor-pointer items-center gap-3 rounded-card border p-4 transition", method === m.value ? "border-royal bg-royal-soft" : "border-line hover:bg-surface-2")}>
                  <input type="radio" name="method" value={m.value} checked={method === m.value} onChange={() => setMethod(m.value)} className="size-4 accent-[var(--lc-royal)]" />
                  <span className="text-royal-ink">{m.icon}</span>
                  <span>
                    <span className="block text-sm font-semibold text-ink">{m.label}</span>
                    <span className="block text-xs text-muted">{m.desc}</span>
                  </span>
                </label>
              ))}
            </div>
            <Button size="lg" className="mt-6 w-full" loading={busy} onClick={pay}>Payer {formatFcfa(reservation.total)}</Button>
            <p className="mt-3 flex items-center gap-1.5 text-xs text-muted"><ShieldCheck size={14} /> Paiement unique, réparti automatiquement entre les loueurs.</p>
            {reservation.cashTotal > 0 && (
              <p className="mt-2 flex items-start gap-1.5 text-xs text-muted"><HandCoins size={14} className="mt-0.5 shrink-0" /> Vous réglerez en plus {formatFcfa(reservation.cashTotal)} en espèces, directement aux loueurs concernés, à la remise du matériel.</p>
            )}
          </Card>
        ) : (
          <Card className="border-royal/40 p-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-warn">Passerelle simulée</p>
            <h2 className="mt-1 text-lg font-semibold text-ink">Confirmer le paiement avec {METHODS.find((m) => m.value === method)?.label}</h2>
            <p className="mt-2 text-sm text-muted">Dans un environnement réel, le fournisseur de paiement vous demanderait de valider sur votre téléphone, puis notifierait LOC&apos;CONNECT par webhook signé. Ici, choisissez le résultat à simuler.</p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button size="lg" loading={busy} onClick={() => simulate("success")} className="flex-1">Simuler un paiement réussi</Button>
              <Button size="lg" variant="secondary" disabled={busy} onClick={() => simulate("failure")} className="flex-1">Simuler un échec</Button>
            </div>
          </Card>
        )}
      </div>

      <aside>
        <Card className="p-5 lg:sticky lg:top-24">
          <h2 className="text-lg font-semibold text-ink">Réservation {reservation.reference}</h2>
          <ul className="mt-4 space-y-4">
            {grouped.map((g) => (
              <li key={g.name}>
                <p className="text-sm font-semibold text-ink">{g.name}</p>
                <ul className="mt-1 space-y-1 text-sm">
                  {g.items.map((i) => (
                    <li key={i.id} className="flex justify-between gap-3 text-muted">
                      <span className="min-w-0 truncate">{i.quantity} x {i.productName}<span className="block text-xs">{formatDate(i.startDate)} au {formatDate(i.endDate)}</span></span>
                      <span className="shrink-0 tabular-nums text-ink">{formatFcfa(i.subtotal)}</span>
                    </li>
                  ))}
                  {g.delivery > 0 && <li className="flex justify-between text-muted"><span>Livraison</span><span className="tabular-nums text-ink">{formatFcfa(g.delivery)}</span></li>}
                  {g.cash > 0 && <li className="flex justify-between gap-3 rounded-control bg-warn-soft/60 px-2 py-1 text-ink"><span>En espèces à la remise</span><span className="shrink-0 tabular-nums">{formatFcfa(g.cash)}</span></li>}
                </ul>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-2 border-t border-line pt-4 text-sm">
            <div className="flex justify-between"><dt className="text-muted">Locations</dt><dd className="tabular-nums">{formatFcfa(reservation.subtotal)}</dd></div>
            {reservation.deliveryFee > 0 && <div className="flex justify-between"><dt className="text-muted">Livraison</dt><dd className="tabular-nums">{formatFcfa(reservation.deliveryFee)}</dd></div>}
            <div className="flex justify-between"><dt className="text-muted">Cautions</dt><dd className="tabular-nums">{formatFcfa(reservation.depositTotal)}</dd></div>
            {reservation.cashTotal > 0 && <div className="flex justify-between"><dt className="text-muted">En espèces aux loueurs</dt><dd className="tabular-nums">- {formatFcfa(reservation.cashTotal)}</dd></div>}
            <div className="flex justify-between border-t border-line pt-3 text-base font-semibold"><dt>{reservation.cashTotal > 0 ? "À payer en ligne" : "Total"}</dt><dd className="tabular-nums">{formatFcfa(reservation.total)}</dd></div>
          </dl>
        </Card>
      </aside>
    </div>
  );
}
