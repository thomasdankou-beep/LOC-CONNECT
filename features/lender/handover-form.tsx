"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { SignaturePad } from "@/components/ui/signature-pad";
import type { Signature } from "@/lib/signature";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { api, ApiError } from "@/lib/api-client";
import type { readHandover } from "@/lib/material-check";

export function HandoverForm({ id, name, quantity, check }: { id: string; name: string; quantity: number; check: ReturnType<typeof readHandover> }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [signature, setSignature] = useState<Signature>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    setPending(true);
    setError(undefined);
    try {
      await api(`/api/reservation-items/${id}/handover`, {
        body: {
          quantity: Number(fields.get("quantity")),
          condition: fields.get("condition"),
          recipient: fields.get("recipient"),
          signature: signature.length ? signature : undefined,
          packaging: fields.get("packaging"),
          accessories: fields.get("accessories"),
          notes: fields.get("notes"),
        },
      });
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Le contrôle n’a pas pu être enregistré.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => { setError(undefined); setSignature([]); setOpen(true); }}>{check ? "Corriger le contrôle de remise" : "Contrôler la remise"}</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Contrôle de remise" description={name}>
        {open && (
          <form onSubmit={submit} className="space-y-3">
            <Input name="quantity" label="Quantité réellement remise" type="number" min={0} max={quantity} defaultValue={Math.min(check?.quantity ?? quantity, quantity)} required />
            <Select name="condition" label="État à la remise" defaultValue={check?.condition ?? "GOOD"}>
              <option value="GOOD">Bon état</option>
              <option value="WITH_RESERVATIONS">Avec réserves</option>
            </Select>
            <Input name="recipient" label="Nom de la personne qui reçoit le matériel" defaultValue={check?.recipient} maxLength={120} required />
            <Input name="packaging" label="Emballages remis" defaultValue={check?.packaging} placeholder="Ex. 5 housses" maxLength={300} />
            <Input name="accessories" label="Accessoires remis" defaultValue={check?.accessories} placeholder="Ex. 2 câbles" maxLength={300} />
            <Textarea name="notes" label="Observations et réserves" defaultValue={check?.notes} maxLength={1000} rows={3} />
            {check?.signature && <SignaturePad label="Renouveler la signature de cette fiche" strokes={signature} onChange={setSignature} />}
            {error && <p role="alert" className="text-sm text-danger">{error}</p>}
            <Button type="submit" loading={pending}>Enregistrer la remise</Button>
          </form>
        )}
      </Modal>
    </>
  );
}
