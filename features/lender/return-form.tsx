"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, ApiError } from "@/lib/api-client";
import { formatFcfa } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/field";
import { FilePicker } from "@/components/ui/file-picker";
import { Modal } from "@/components/ui/modal";
import { Notice } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";

export type ReturnItem = { id: string; productName: string; quantity: number; refundPrice: number; depositAmount: number; allowsExtraBilling: boolean; reference: string };

/** Constat de retour : quantités retournées, perdues, endommagées, preuves photo. Calcul de la retenue en direct (le serveur recalcule). */
export function ReturnReportButton({ item, evidenceRequired, canPhoto, canDamage, defaultOpen = false }: { item: ReturnItem; evidenceRequired: boolean; canPhoto: boolean; canDamage: boolean; defaultOpen?: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(defaultOpen);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [lost, setLost] = useState(0);
  const [damaged, setDamaged] = useState(0);
  const [damageAmount, setDamageAmount] = useState(0);
  const [photos, setPhotos] = useState(0);

  const returned = item.quantity - lost;
  const lostAmount = lost * item.refundPrice;
  const totalDamage = lostAmount + damageAmount;
  const withheld = Math.min(totalDamage, item.depositAmount);
  const extra = item.allowsExtraBilling ? totalDamage - withheld : 0;
  const released = item.depositAmount - withheld;
  const needsEvidence = evidenceRequired && totalDamage > 0 && photos === 0;

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const form = new FormData();
    form.set("data", JSON.stringify({ returnedQuantity: returned, lostQuantity: lost, damagedQuantity: damaged, condition: String(fd.get("condition") || "GOOD"), comment: String(fd.get("comment") ?? "").trim() || undefined, damageAmount }));
    for (const f of fd.getAll("photos")) if (f instanceof File && f.size > 0) form.append("photos", f);
    setPending(true);
    setError(null);
    try {
      await api(`/api/reservation-items/${item.id}/return-report`, { form });
      toast({ tone: "success", title: "Constat enregistré", description: totalDamage > 0 ? "Le client peut l'accepter ou le contester." : "Caution restituée au client." });
      setOpen(false);
      router.replace("/loueur/retours");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError("Une erreur est survenue.", "INTERNAL_ERROR", 500));
    } finally {
      setPending(false);
    }
  }
  const fe = (n: string) => error?.details?.find((d) => d.path === n)?.message;

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>Constater le retour</Button>
      <Modal open={open} onClose={() => setOpen(false)} size="lg" title={`Constat de retour : ${item.productName}`} description={`Réservation ${item.reference}, ${item.quantity} unité${item.quantity > 1 ? "s" : ""} louée${item.quantity > 1 ? "s" : ""}.`}>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="grid items-start gap-4 sm:grid-cols-3">
            <Input label="Unités perdues" type="number" min={0} max={item.quantity} value={lost} onChange={(e) => { const v = Math.max(0, Math.min(item.quantity, Number(e.target.value) || 0)); setLost(v); if (damaged > item.quantity - v) setDamaged(item.quantity - v); }} disabled={!canDamage} hint={`Remboursées ${formatFcfa(item.refundPrice)} l'unité`} />
            <Input label="Unités endommagées" type="number" min={0} max={returned} value={damaged} onChange={(e) => { const v = Math.max(0, Math.min(returned, Number(e.target.value) || 0)); setDamaged(v); if (v === 0) setDamageAmount(0); }} disabled={!canDamage} hint={`Sur ${returned} retournée${returned > 1 ? "s" : ""}`} />
            <Input label="Dommages (FCFA)" type="number" min={0} max={damaged * item.refundPrice} value={damageAmount} onChange={(e) => setDamageAmount(Math.max(0, Number(e.target.value) || 0))} disabled={damaged === 0} error={fe("damageAmount")} hint={damaged > 0 ? `Maximum ${formatFcfa(damaged * item.refundPrice)}` : undefined} />
          </div>
          <Select label="État général du matériel retourné" name="condition" defaultValue="GOOD">
            <option value="EXCELLENT">Excellent</option>
            <option value="GOOD">Bon</option>
            <option value="FAIR">Correct</option>
          </Select>
          <Textarea label="Commentaire" name="comment" rows={3} placeholder="Observations sur l'état du matériel" />
          {canPhoto && <FilePicker name="photos" multiple label={`Photos de preuve ${totalDamage > 0 && evidenceRequired ? "(obligatoires)" : "(facultatives)"}`} hint="8 photos maximum. Elles restent privées : client, vous et administration." onCount={setPhotos} />}

          <div className="rounded-control bg-surface-2/60 p-4 text-sm">
            <p className="font-medium text-ink">Effet sur la caution de {formatFcfa(item.depositAmount)}</p>
            <dl className="mt-2 space-y-1">
              <div className="flex justify-between"><dt className="text-muted">Retenue pour vous</dt><dd className="tabular-nums text-ink">{formatFcfa(withheld)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Restituée au client</dt><dd className="tabular-nums text-ink">{formatFcfa(released)}</dd></div>
              {item.allowsExtraBilling && extra > 0 && <div className="flex justify-between"><dt className="text-muted">Complément facturé au client</dt><dd className="tabular-nums text-ink">{formatFcfa(extra)}</dd></div>}
            </dl>
            {totalDamage > 0 ? <p className="mt-2 text-xs text-muted">Le client dispose d&apos;un délai pour accepter ou contester. La caution et la retenue restent bloquées pendant ce délai.</p> : <p className="mt-2 text-xs text-muted">Sans dommage, la caution est restituée immédiatement.</p>}
          </div>
          {needsEvidence && <Notice tone="warning">Ajoutez au moins une photo pour retenir une partie de la caution.</Notice>}
          {error && !error.details?.length && <Notice tone="danger">{error.message}</Notice>}
          <div className="sticky bottom-0 -mx-5 -mb-4 flex justify-end gap-2 border-t border-line bg-surface px-5 py-3"><Button variant="secondary" onClick={() => setOpen(false)}>Annuler</Button><Button type="submit" loading={pending} disabled={needsEvidence}>Enregistrer le constat</Button></div>
        </form>
      </Modal>
    </>
  );
}
