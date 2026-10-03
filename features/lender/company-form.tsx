"use client";

import { useState } from "react";
import { useAction } from "@/hooks/use-action";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Checkbox, Input, Textarea } from "@/components/ui/field";
import { Notice } from "@/components/ui/states";

type Company = { companyName: string; description: string; phone: string; email: string; address: string; offersDelivery: boolean; deliveryFeeLocal: number; deliveryFeeRemote: number };

export function CompanyForm({ company, canEdit }: { company: Company; canEdit: boolean }) {
  const { run, pending, error } = useAction();
  const [delivery, setDelivery] = useState(company.offersDelivery);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const str = (k: string) => String(fd.get(k) ?? "").trim();
    await run("/api/lenders/me", { method: "PATCH", body: { companyName: str("companyName"), description: str("description"), phone: str("phone"), email: str("email") || undefined, address: str("address"), offersDelivery: delivery, deliveryFeeLocal: Number(str("deliveryFeeLocal") || 0), deliveryFeeRemote: Number(str("deliveryFeeRemote") || 0) } }, { success: "Entreprise mise à jour", silentError: true });
  }
  const fe = (n: string) => error?.details?.find((d) => d.path === n)?.message;

  return (
    <Card>
      <CardHeader title="Profil de l'entreprise" description="Ces informations sont visibles sur votre page publique." />
      <form onSubmit={submit} className="flex flex-col gap-4 p-5">
        <fieldset disabled={!canEdit} className="flex min-w-0 flex-col gap-4">
          <Input label="Nom commercial" name="companyName" defaultValue={company.companyName} required error={fe("companyName")} />
          <Textarea label="Présentation" name="description" defaultValue={company.description} rows={4} error={fe("description")} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Téléphone" name="phone" type="tel" defaultValue={company.phone} error={fe("phone")} />
            <Input label="E-mail professionnel" name="email" type="email" defaultValue={company.email} error={fe("email")} />
          </div>
          <Input label="Adresse" name="address" defaultValue={company.address} error={fe("address")} />
          <div className="rounded-control border border-line p-4">
            <Checkbox label="Je propose la livraison" checked={delivery} onChange={(e) => setDelivery(e.target.checked)} />
            {delivery && (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Input label="Frais de livraison, même ville (FCFA)" name="deliveryFeeLocal" type="number" min={0} defaultValue={company.deliveryFeeLocal} error={fe("deliveryFeeLocal")} />
                <Input label="Frais de livraison, autre ville (FCFA)" name="deliveryFeeRemote" type="number" min={0} defaultValue={company.deliveryFeeRemote} error={fe("deliveryFeeRemote")} />
              </div>
            )}
          </div>
        </fieldset>
        {error && !error.details?.length && <Notice tone="danger">{error.message}</Notice>}
        {canEdit ? <div><Button type="submit" loading={pending}>Enregistrer</Button></div> : <Notice tone="info">Votre rôle ne permet pas de modifier l&apos;entreprise.</Notice>}
      </form>
    </Card>
  );
}
