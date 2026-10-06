"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Checkbox, Input, Select, Textarea } from "@/components/ui/field";
import { Notice } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { UploadSimple } from "@/components/ui/icons";

type Cat = { id: string; name: string; children: { id: string; name: string }[] };
type City = { id: string; name: string };
export type ProductDefaults = { id?: string; name: string; description: string; conditions: string; categoryId: string; cityId: string; unitPrice: number; stockQuantity: number; depositAmount: number; refundPrice: number; minDays: number; maxDays: number | null; allowsExtraBilling: boolean };

export function ProductForm({ categories, cities, defaults, canPublish, depositPercent }: { categories: Cat[]; cities: City[]; defaults: ProductDefaults; canPublish: boolean; depositPercent: number | null }) {
  const router = useRouter();
  const { toast } = useToast();
  const editing = Boolean(defaults.id);
  const [files, setFiles] = useState<File[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const fe = (n: string) => error?.details?.find((d) => d.path === n)?.message;

  async function submit(e: React.FormEvent<HTMLFormElement>, publish: boolean) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const num = (k: string) => Number(fd.get(k) || 0);
    const maxDays = String(fd.get("maxDays") ?? "").trim();
    const body = {
      name: String(fd.get("name")),
      description: String(fd.get("description")),
      conditions: String(fd.get("conditions") ?? "").trim() || undefined,
      categoryId: String(fd.get("categoryId")),
      cityId: String(fd.get("cityId")),
      unitPrice: num("unitPrice"),
      depositAmount: num("depositAmount"),
      refundPrice: num("refundPrice"),
      minDays: num("minDays") || 1,
      maxDays: maxDays ? Number(maxDays) : null,
      allowsExtraBilling: fd.get("allowsExtraBilling") === "on",
    };
    setPending(true);
    setError(null);
    try {
      let id = defaults.id;
      if (editing) {
        await api(`/api/products/${id}`, { method: "PATCH", body });
      } else {
        const created = await api<{ id: string }>("/api/products", { body: { ...body, stockQuantity: num("stockQuantity"), publish } });
        id = created.id;
      }
      for (const f of files) {
        const form = new FormData();
        form.set("file", f);
        await api(`/api/products/${id}/photos`, { form });
      }
      toast({ tone: "success", title: editing ? "Produit mis à jour" : publish ? "Produit soumis à modération" : "Brouillon enregistré" });
      router.push(`/loueur/produits/${id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError("Une erreur est survenue.", "INTERNAL_ERROR", 500));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={(e) => submit(e, (e.nativeEvent as SubmitEvent).submitter?.getAttribute("data-publish") === "1")} className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
      <div className="space-y-6">
        <Card>
          <CardHeader title="Présentation" />
          <div className="flex flex-col gap-4 p-5">
            <Input label="Nom du produit" name="name" defaultValue={defaults.name} required minLength={3} error={fe("name")} />
            <Textarea label="Description" name="description" defaultValue={defaults.description} required minLength={20} rows={5} hint="Matériel fourni, dimensions, usage conseillé." error={fe("description")} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Select label="Catégorie" name="categoryId" defaultValue={defaults.categoryId} required error={fe("categoryId")}>
                <option value="" disabled>Choisir</option>
                {categories.map((c) => (
                  <optgroup key={c.id} label={c.name}>
                    {c.children.map((ch) => <option key={ch.id} value={ch.id}>{ch.name}</option>)}
                  </optgroup>
                ))}
              </Select>
              <Select label="Ville" name="cityId" defaultValue={defaults.cityId} required error={fe("cityId")}>
                <option value="" disabled>Choisir</option>
                {cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </div>
            <Textarea label="Conditions de location (facultatif)" name="conditions" defaultValue={defaults.conditions} rows={3} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Tarifs, stock et caution" description="Les prix sont par jour. Une modification de prix n'affecte jamais une réservation existante." />
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Input label="Prix par jour (FCFA)" name="unitPrice" type="number" min={1} defaultValue={defaults.unitPrice || ""} required error={fe("unitPrice")} />
            {!editing && <Input label="Stock initial" name="stockQuantity" type="number" min={0} defaultValue={defaults.stockQuantity || ""} required error={fe("stockQuantity")} />}
            {depositPercent != null ? (
              <div className="rounded-control border border-line bg-surface-2/60 px-3 py-2.5 text-sm">
                <input type="hidden" name="depositAmount" value={defaults.depositAmount || 0} />
                <p className="font-medium text-ink">Caution : {depositPercent} % de la location</p>
                <p className="mt-0.5 text-muted">Calculée automatiquement par LOC&apos;CONNECT sur le montant de location de vos articles dans chaque commande.</p>
              </div>
            ) : (
              <Input label="Caution par unité (FCFA)" name="depositAmount" type="number" min={0} defaultValue={defaults.depositAmount || 0} required error={fe("depositAmount")} />
            )}
            <Input label="Prix de remboursement par unité (FCFA)" name="refundPrice" type="number" min={0} defaultValue={defaults.refundPrice || 0} required hint="Appliqué aux unités perdues ou détruites." error={fe("refundPrice")} />
            <Input label="Durée minimale (jours)" name="minDays" type="number" min={1} defaultValue={defaults.minDays} error={fe("minDays")} />
            <Input label="Durée maximale (jours)" name="maxDays" type="number" min={1} defaultValue={defaults.maxDays ?? ""} hint="Laisser vide pour la limite de la plateforme." error={fe("maxDays")} />
            <div className="sm:col-span-2">
              <Checkbox name="allowsExtraBilling" defaultChecked={defaults.allowsExtraBilling} label={<><span className="font-medium">Autoriser la facturation complémentaire</span><span className="block text-muted">Si un dommage dépasse la caution, le complément est facturé au client. Sinon la perte reste à votre charge.</span></>} />
            </div>
          </div>
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader title="Photos" description="JPEG, PNG ou WebP, 6 Mo maximum, 10 photos par produit." />
          <div className="p-5">
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed border-line px-4 py-8 text-center transition hover:bg-surface-2/60">
              <UploadSimple size={28} className="text-royal-ink" />
              <span className="text-sm font-medium text-ink">Ajouter des photos</span>
              <span className="text-xs text-muted">{files.length ? files.map((f) => f.name).join(", ") : "Aucun fichier choisi"}</span>
              <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={(e) => setFiles([...(e.target.files ?? [])].slice(0, 10))} />
            </label>
          </div>
        </Card>
        {error && !error.details?.length && <div role="alert"><Notice tone="danger">{error.message}</Notice></div>}
        <Card className="p-5">
          {editing ? (
            <Button type="submit" size="lg" className="w-full" loading={pending}>Enregistrer les modifications</Button>
          ) : (
            <div className="grid gap-2">
              <Button type="submit" size="lg" data-publish="1" loading={pending} disabled={!canPublish}>Soumettre à la modération</Button>
              <Button type="submit" size="lg" variant="secondary" data-publish="0" loading={pending}>Enregistrer en brouillon</Button>
              {!canPublish && <p className="text-xs text-muted">La publication sera possible dès la validation de votre entreprise.</p>}
            </div>
          )}
        </Card>
      </div>
    </form>
  );
}
