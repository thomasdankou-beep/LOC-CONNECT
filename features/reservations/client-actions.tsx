"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api-client";
import { formatFcfa } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { Notice, Skeleton } from "@/components/ui/states";
import { useAction } from "@/hooks/use-action";
import { useToast } from "@/components/ui/toast";
import { Star } from "@/components/ui/icons";
import { cn } from "@/lib/cn";

// ---------------------------------------------------------------------------
// Annulation avec aperçu du remboursement
// ---------------------------------------------------------------------------

type Plan = { lines: { itemId: string; productName: string; percent: number; rentalRefund: number; depositRefund: number; hoursBeforeStart: number }[]; deliveryTotal: number; rentalTotal: number; depositTotal: number; clientTotal: number; policyName: string };

export function CancelButton({ reservationId, itemIds, label = "Annuler la réservation" }: { reservationId: string; itemIds?: string[]; label?: string }) {
  const { run, pending } = useAction();
  const [open, setOpen] = useState(false);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!open) return;
    setPlan(null);
    setError(null);
    api<Plan>(`/api/reservations/${reservationId}/cancellation-preview${itemIds ? `?itemIds=${itemIds.join(",")}` : ""}`)
      .then(setPlan)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Aperçu indisponible."));
  }, [open, reservationId, itemIds]);

  async function confirm() {
    const res = await run(`/api/reservations/${reservationId}/cancel`, { body: { itemIds, reason: reason.trim() || "Annulation demandée par le client" } }, { success: "Réservation annulée" });
    if (res !== undefined) setOpen(false);
  }

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>{label}</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Annuler la réservation" description="Le remboursement dépend de la politique d'annulation et du délai avant le début." footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Garder la réservation</Button><Button variant="danger" loading={pending} disabled={!plan} onClick={confirm}>Confirmer l&apos;annulation</Button></>}>
        {error && <Notice tone="danger">{error}</Notice>}
        {!plan && !error && <Skeleton className="h-32 w-full" />}
        {plan && (
          <div className="space-y-4">
            <ul className="divide-y divide-line rounded-control border border-line text-sm">
              {plan.lines.map((l) => (
                <li key={l.itemId} className="flex items-start justify-between gap-3 px-3 py-2.5">
                  <div>
                    <p className="font-medium text-ink">{l.productName}</p>
                    <p className="text-xs text-muted">Remboursement de {l.percent} % ({l.hoursBeforeStart} h avant le début)</p>
                  </div>
                  <p className="tabular-nums text-ink">{formatFcfa(l.rentalRefund)}</p>
                </li>
              ))}
            </ul>
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between"><dt className="text-muted">Locations remboursées</dt><dd className="tabular-nums">{formatFcfa(plan.rentalTotal)}</dd></div>
              {plan.deliveryTotal > 0 && <div className="flex justify-between"><dt className="text-muted">Livraison remboursée</dt><dd className="tabular-nums">{formatFcfa(plan.deliveryTotal)}</dd></div>}
              <div className="flex justify-between"><dt className="text-muted">Cautions restituées</dt><dd className="tabular-nums">{formatFcfa(plan.depositTotal)}</dd></div>
              <div className="flex justify-between border-t border-line pt-2 text-base font-semibold"><dt>Total remboursé</dt><dd className="tabular-nums">{formatFcfa(plan.clientTotal)}</dd></div>
            </dl>
            <Textarea label="Motif (facultatif)" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
        )}
      </Modal>
    </>
  );
}

// ---------------------------------------------------------------------------
// Litige ciblé sur un loueur
// ---------------------------------------------------------------------------

export function DisputeButton({ reservationId, lenders }: { reservationId: string; lenders: { id: string; name: string; items: { id: string; name: string }[] }[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [lenderId, setLenderId] = useState(lenders[0]?.id ?? "");
  const [error, setError] = useState<ApiError | null>(null);
  const [pending, setPending] = useState(false);
  const items = lenders.find((l) => l.id === lenderId)?.items ?? [];

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setPending(true);
    setError(null);
    try {
      const d = await api<{ id: string }>(`/api/reservations/${reservationId}/dispute`, {
        body: { lenderId, itemId: String(fd.get("itemId") ?? "") || undefined, reason: String(fd.get("reason")), description: String(fd.get("description")), disputedAmount: Number(fd.get("amount") || 0) },
      });
      toast({ tone: "success", title: "Litige ouvert", description: "Seul le loueur concerné est impliqué." });
      setOpen(false);
      router.push(`/mes-litiges/${d.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError("Une erreur est survenue.", "INTERNAL_ERROR", 500));
    } finally {
      setPending(false);
    }
  }
  const fe = (n: string) => error?.details?.find((d) => d.path === n)?.message;

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>Ouvrir un litige</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Ouvrir un litige" description="Le litige cible un seul loueur. Les autres loueurs de votre commande ne sont pas concernés.">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Select label="Loueur concerné" value={lenderId} onChange={(e) => setLenderId(e.target.value)}>
            {lenders.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </Select>
          <Select label="Article concerné" name="itemId" defaultValue="">
            <option value="">Tous les articles de ce loueur</option>
            {items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
          </Select>
          <Input label="Motif" name="reason" required minLength={3} placeholder="Ex : matériel non conforme" error={fe("reason")} />
          <Textarea label="Description" name="description" required minLength={10} rows={4} placeholder="Décrivez le problème avec précision." error={fe("description")} />
          <Input label="Montant contesté (FCFA)" name="amount" type="number" min={0} defaultValue={0} error={fe("disputedAmount")} />
          {error && !error.details?.length && <Notice tone="danger">{error.message}</Notice>}
          <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setOpen(false)}>Annuler</Button><Button type="submit" loading={pending}>Ouvrir le litige</Button></div>
        </form>
      </Modal>
    </>
  );
}

// ---------------------------------------------------------------------------
// Constat de retour : accepter ou contester
// ---------------------------------------------------------------------------

export function ReturnReportActions({ itemId, deadline }: { itemId: string; deadline: string | null }) {
  const router = useRouter();
  const { run, pending } = useAction();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

  async function contest() {
    const res = await run<{ id: string }>(`/api/reservation-items/${itemId}/return-report/contest`, { body: { reason } }, { success: "Constat contesté, caution gelée", refresh: false });
    if (res) router.push(`/mes-litiges/${res.id}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" loading={pending && !open} onClick={() => run(`/api/reservation-items/${itemId}/return-report/acknowledge`, { body: {} }, { success: "Constat accepté, caution réglée" })}>Accepter le constat</Button>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>Contester</Button>
      {deadline && <span className="text-xs text-muted">Contestation possible jusqu&apos;au {new Date(deadline).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>}
      <Modal open={open} onClose={() => setOpen(false)} title="Contester le constat" description="La caution est gelée et un litige est ouvert contre le loueur concerné." footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Annuler</Button><Button loading={pending} disabled={reason.trim().length < 10} onClick={contest}>Envoyer la contestation</Button></>}>
        <Textarea label="Motif de la contestation" rows={4} value={reason} onChange={(e) => setReason(e.target.value)} hint="10 caractères minimum. Joignez vos preuves dans le litige." />
      </Modal>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Avis
// ---------------------------------------------------------------------------

function RatingInput({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium text-ink">{label}</legend>
      <div className="flex gap-1" role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} sur 5`} onClick={() => onChange(n)} className="flex size-10 items-center justify-center rounded-control hover:bg-surface-2">
            <Star size={24} weight={n <= value ? "fill" : "regular"} className={cn(n <= value ? "text-warn" : "text-muted")} />
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function ReviewButton({ itemId, productName }: { itemId: string; productName: string }) {
  const { run, pending } = useAction();
  const [open, setOpen] = useState(false);
  const [p, setP] = useState(5);
  const [l, setL] = useState(5);
  const [x, setX] = useState(5);
  const [comment, setComment] = useState("");

  async function submit() {
    const res = await run(`/api/reservation-items/${itemId}/review`, { body: { productRating: p, lenderRating: l, experienceRating: x, comment: comment.trim() || undefined } }, { success: "Merci pour votre avis" });
    if (res !== undefined) setOpen(false);
  }

  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>Laisser un avis</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Votre avis" description={productName} footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Annuler</Button><Button loading={pending} onClick={submit}>Publier</Button></>}>
        <div className="space-y-4">
          <RatingInput label="Le produit" value={p} onChange={setP} />
          <RatingInput label="Le loueur" value={l} onChange={setL} />
          <RatingInput label="Votre expérience" value={x} onChange={setX} />
          <Textarea label="Commentaire (facultatif)" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1500} />
        </div>
      </Modal>
    </>
  );
}

// ---------------------------------------------------------------------------
// Modification d'une réservation confirmée
// ---------------------------------------------------------------------------

type ModItem = { id: string; name: string; quantity: number; startDate: string; endDate: string; lenderId: string; lenderName: string };
type Preview = { amountBefore: number; amountAfter: number; depositBefore: number; depositAfter: number; commissionBefore: number; commissionAfter: number; differenceToPay: number; refundToIssue: number; availability: { ok: boolean; message?: string } };

export function ModificationButton({ reservationId, items, lenderProducts }: { reservationId: string; items: ModItem[]; lenderProducts: { lenderId: string; products: { id: string; name: string }[] }[] }) {
  const { run, pending } = useAction();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"UPDATE" | "REMOVE" | "ADD">("UPDATE");
  const [itemId, setItemId] = useState(items[0]?.id ?? "");
  const [quantity, setQuantity] = useState(items[0]?.quantity ?? 1);
  const [start, setStart] = useState(items[0]?.startDate ?? "");
  const [end, setEnd] = useState(items[0]?.endDate ?? "");
  const [productId, setProductId] = useState("");
  const [reason, setReason] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const item = items.find((i) => i.id === itemId);
  const addable = lenderProducts.find((l) => l.lenderId === item?.lenderId)?.products ?? [];

  function select(id: string) {
    const it = items.find((i) => i.id === id);
    setItemId(id);
    if (it) {
      setQuantity(it.quantity);
      setStart(it.startDate);
      setEnd(it.endDate);
    }
  }

  const line =
    mode === "REMOVE"
      ? { action: "REMOVE" as const, itemId }
      : mode === "ADD"
        ? { action: "ADD" as const, productId, quantity, startDate: start, endDate: end }
        : { action: "UPDATE" as const, itemId, quantity, startDate: start, endDate: end };

  useEffect(() => {
    if (!open) return;
    if (mode === "ADD" && !productId) return setPreview(null);
    setError(null);
    setLoading(true);
    const t = setTimeout(() => {
      api<Preview>(`/api/reservations/${reservationId}/modifications/preview`, { body: { lines: [line] } })
        .then(setPreview)
        .catch((e) => {
          setPreview(null);
          setError(e instanceof ApiError ? e.message : "Aperçu indisponible.");
        })
        .finally(() => setLoading(false));
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, itemId, quantity, start, end, productId]);

  async function submit() {
    const res = await run(`/api/reservations/${reservationId}/modifications`, { body: { reason: reason.trim() || undefined, lines: [line] } }, { success: "Demande envoyée au loueur" });
    if (res !== undefined) setOpen(false);
  }

  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>Modifier la réservation</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Demander une modification" description="Rien n'est appliqué avant la validation du loueur. Vous ne payez que le complément éventuel." size="lg" footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Annuler</Button><Button loading={pending} disabled={!preview || !preview.availability.ok} onClick={submit}>Envoyer la demande</Button></>}>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Type de modification" value={mode} onChange={(e) => setMode(e.target.value as typeof mode)}>
              <option value="UPDATE">Changer quantité ou dates</option>
              <option value="REMOVE">Supprimer une ligne</option>
              <option value="ADD">Ajouter un article du même loueur</option>
            </Select>
            <Select label="Ligne concernée" value={itemId} onChange={(e) => select(e.target.value)}>
              {items.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.lenderName})</option>)}
            </Select>
          </div>
          {mode === "ADD" && (
            <Select label="Article à ajouter" value={productId} onChange={(e) => setProductId(e.target.value)}>
              <option value="">Choisir</option>
              {addable.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          )}
          {mode !== "REMOVE" && (
            <div className="grid gap-4 sm:grid-cols-3">
              <Input label="Quantité" type="number" min={1} value={quantity} onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))} />
              <Input label="Début" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
              <Input label="Retour" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          )}
          <Textarea label="Motif (facultatif)" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
          {error && <div role="alert"><Notice tone="danger">{error}</Notice></div>}
          {loading && <Skeleton className="h-28 w-full" />}
          {preview && !loading && (
            <div className="space-y-3">
              {!preview.availability.ok && <Notice tone="danger">{preview.availability.message}</Notice>}
              <dl className="grid gap-2 rounded-control border border-line bg-surface-2/50 p-4 text-sm sm:grid-cols-2">
                <div className="flex justify-between gap-3"><dt className="text-muted">Location avant / après</dt><dd className="tabular-nums">{formatFcfa(preview.amountBefore)} / {formatFcfa(preview.amountAfter)}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-muted">Caution avant / après</dt><dd className="tabular-nums">{formatFcfa(preview.depositBefore)} / {formatFcfa(preview.depositAfter)}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-muted">Commission avant / après</dt><dd className="tabular-nums">{formatFcfa(preview.commissionBefore)} / {formatFcfa(preview.commissionAfter)}</dd></div>
                <div className="flex justify-between gap-3 font-semibold"><dt className="text-ink">{preview.refundToIssue > 0 ? "Remboursement" : "Complément à payer"}</dt><dd className="tabular-nums text-ink">{formatFcfa(preview.refundToIssue > 0 ? preview.refundToIssue : preview.differenceToPay)}</dd></div>
              </dl>
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
