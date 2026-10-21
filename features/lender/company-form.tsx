"use client";

import { useState } from "react";
import { useAction } from "@/hooks/use-action";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Checkbox, Input, Textarea } from "@/components/ui/field";
import { Notice } from "@/components/ui/states";
import { LogoUploader } from "./logo-uploader";

type Company = { companyName: string; description: string; phone: string; email: string; address: string; offersDelivery: boolean; deliveryRequired: boolean; deliveryFeeLocal: number; deliveryFeeRemote: number; rccm: string; taxNumber: string; vatRegistered: boolean; shareCapital: number | null; postalAddress: string; terms: string; logoUrl: string | null };

export function CompanyForm({ company, canEdit }: { company: Company; canEdit: boolean }) {
  const { run, pending, error } = useAction();
  const [delivery, setDelivery] = useState(company.offersDelivery);
  const [required, setRequired] = useState(company.deliveryRequired);
  const [vat, setVat] = useState(company.vatRegistered);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const str = (k: string) => String(fd.get(k) ?? "").trim();
    await run("/api/lenders/me", { method: "PATCH", body: { companyName: str("companyName"), description: str("description"), phone: str("phone"), email: str("email") || undefined, address: str("address"), offersDelivery: delivery, deliveryRequired: delivery && required, deliveryFeeLocal: Number(str("deliveryFeeLocal") || 0), deliveryFeeRemote: Number(str("deliveryFeeRemote") || 0), rccm: str("rccm"), taxNumber: str("taxNumber"), vatRegistered: vat, shareCapital: str("shareCapital") ? Number(str("shareCapital")) : null, postalAddress: str("postalAddress"), terms: str("terms") } }, { success: "Entreprise mise à jour", silentError: true });
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
              <div className="mt-3">
                <Checkbox label={<><span className="font-medium">La livraison est obligatoire</span><span className="block text-muted">Vos clients ne peuvent pas retirer le matériel chez vous : la livraison et la récupération sont facturées sur chaque commande.</span></>} checked={required} onChange={(e) => setRequired(e.target.checked)} />
              </div>
            )}
            {delivery && (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Input label="Frais de livraison, même ville (FCFA)" name="deliveryFeeLocal" type="number" min={0} defaultValue={company.deliveryFeeLocal} error={fe("deliveryFeeLocal")} />
                <Input label="Frais de livraison, autre ville (FCFA)" name="deliveryFeeRemote" type="number" min={0} defaultValue={company.deliveryFeeRemote} error={fe("deliveryFeeRemote")} />
              </div>
            )}
          </div>
          <div className="rounded-control border border-line p-4">
            <p className="text-sm font-medium text-ink">Informations de facturation</p>
            <p className="mt-0.5 text-sm text-muted">Elles figurent en en-tête et en pied de page de vos proformas et des factures que LOC&apos;CONNECT émet en votre nom.</p>
            <div className="mt-4">
              <LogoUploader logoUrl={company.logoUrl} disabled={!canEdit} />
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Input label="RCCM" name="rccm" defaultValue={company.rccm} placeholder="CI-ABJ-2024-B-12345" error={fe("rccm")} />
              <Input label="NCC (compte contribuable)" name="taxNumber" defaultValue={company.taxNumber} error={fe("taxNumber")} />
              <Input label="Capital social (FCFA)" name="shareCapital" type="number" min={0} defaultValue={company.shareCapital ?? ""} placeholder="1000000" error={fe("shareCapital")} />
              <Input label="Boîte postale" name="postalAddress" defaultValue={company.postalAddress} placeholder="18 BP 1470 Abidjan 18" error={fe("postalAddress")} />
            </div>
            <div className="mt-4">
              <Textarea label="Conditions générales de location" name="terms" defaultValue={company.terms} rows={10} hint="Imprimées en deuxième page de vos proformas et factures. Le client les accepte en cochant « Lu et approuvé » avant de payer. Une condition par ligne." error={fe("terms")} />
            </div>
            <div className="mt-4">
              <Checkbox label={<><span className="font-medium">Mon entreprise est assujettie à la TVA</span><span className="block text-muted">Vos factures affichent alors le montant HT, la TVA et le TTC. Vos prix restent affichés TTC.</span></>} checked={vat} onChange={(e) => setVat(e.target.checked)} />
            </div>
          </div>
        </fieldset>
        {error && !error.details?.length && <Notice tone="danger">{error.message}</Notice>}
        {canEdit ? <div><Button type="submit" loading={pending}>Enregistrer</Button></div> : <Notice tone="info">Votre rôle ne permet pas de modifier l&apos;entreprise.</Notice>}
      </form>
    </Card>
  );
}
