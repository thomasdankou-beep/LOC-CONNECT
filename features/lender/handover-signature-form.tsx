"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { SignaturePad } from "@/components/ui/signature-pad";
import { api, ApiError } from "@/lib/api-client";
import { signatureInput, type Signature } from "@/lib/signature";

export function HandoverSignatureForm({ reservationId, fingerprint, recipient }: { reservationId: string; fingerprint: string; recipient?: string }) {
  const router = useRouter();
  const [strokes, setStrokes] = useState<Signature>([]);
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string>();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || saved) return;
    const signer = String(new FormData(event.currentTarget).get("signer") ?? "").trim();
    const signature = signatureInput.safeParse(strokes);
    if (!signer || !signature.success) {
      setError("Indiquez le nom du signataire et tracez sa signature.");
      return;
    }
    setPending(true);
    setError(undefined);
    try {
      await api(`/api/reservations/${reservationId}/handover-signature`, { body: { fingerprint, signer, strokes: signature.data } });
      setSaved(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "La signature n’a pas pu être enregistrée.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-4 rounded-control border border-line p-4 print:hidden">
      <h2 className="font-semibold">Signer le bon de remise</h2>
      <p className="text-sm text-muted">Relisez les quantités et les réserves du tableau. La signature couvre tous les articles de ce bon.</p>
      <Input name="signer" label="Nom de la personne qui réceptionne" defaultValue={recipient} required maxLength={120} />
      <SignaturePad label="Signature de réception" strokes={strokes} onChange={setStrokes} />
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <Button type="submit" loading={pending} disabled={saved}>{saved ? "Signature enregistrée" : "Enregistrer la signature du bon"}</Button>
    </form>
  );
}
