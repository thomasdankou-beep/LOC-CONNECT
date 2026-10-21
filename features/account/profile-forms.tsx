"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAction } from "@/hooks/use-action";
import { api, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { Notice } from "@/components/ui/states";

type Profile = { firstName: string; lastName: string; email: string; phone: string; deliveryAddress: string; cityId: string };

export function ProfileForms({ profile, cities, showAddress = true, allowDelete = true }: { profile: Profile; cities: { id: string; name: string }[]; showAddress?: boolean; allowDelete?: boolean }) {
  const router = useRouter();
  const update = useAction();
  const pwd = useAction();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function saveProfile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await update.run("/api/me", { method: "PATCH", body: { firstName: fd.get("firstName"), lastName: fd.get("lastName"), phone: String(fd.get("phone") ?? "") || undefined, ...(showAddress ? { deliveryAddress: String(fd.get("deliveryAddress") ?? "") || undefined, cityId: String(fd.get("cityId") ?? "") || undefined } : {}) } }, { success: "Profil mis à jour", silentError: true });
  }

  async function changePassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const res = await pwd.run("/api/me/password", { body: { current: fd.get("current"), next: fd.get("next") } }, { success: "Mot de passe modifié, reconnectez-vous", refresh: false, silentError: true });
    if (res !== undefined) {
      router.push("/connexion");
      router.refresh();
    }
  }

  async function remove(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setDeleting(true);
    setDeleteError(null);
    try {
      await api("/api/me", { method: "DELETE", body: { password: new FormData(e.currentTarget).get("password") } });
      router.push("/");
      router.refresh();
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : "Suppression impossible.");
    } finally {
      setDeleting(false);
    }
  }

  const fe = (a: ReturnType<typeof useAction>, n: string) => a.error?.details?.find((d) => d.path === n)?.message;

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card>
        <CardHeader title="Informations personnelles" />
        <form onSubmit={saveProfile} className="flex flex-col gap-4 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Prénom" name="firstName" defaultValue={profile.firstName} required error={fe(update, "firstName")} />
            <Input label="Nom" name="lastName" defaultValue={profile.lastName} required error={fe(update, "lastName")} />
          </div>
          <Input label="Adresse e-mail" value={profile.email} readOnly disabled hint="Pour changer d'adresse, contactez le support." />
          <Input label="Téléphone" name="phone" type="tel" defaultValue={profile.phone} error={fe(update, "phone")} />
          {showAddress && (
            <>
              <Input label="Adresse de livraison habituelle" name="deliveryAddress" defaultValue={profile.deliveryAddress} />
              <Select label="Ville" name="cityId" defaultValue={profile.cityId}>
                <option value="">Choisir</option>
                {cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </>
          )}
          {update.error && !update.error.details?.length && <Notice tone="danger">{update.error.message}</Notice>}
          <div><Button type="submit" loading={update.pending}>Enregistrer</Button></div>
        </form>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardHeader title="Mot de passe" description="Le changement déconnecte toutes vos sessions." />
          <form onSubmit={changePassword} className="flex flex-col gap-4 p-5">
            <Input label="Mot de passe actuel" name="current" type="password" autoComplete="current-password" required />
            <Input label="Nouveau mot de passe" name="next" type="password" autoComplete="new-password" required hint="8 caractères minimum, avec au moins une lettre et un chiffre." />
            {pwd.error && <Notice tone="danger">{pwd.error.message}</Notice>}
            <div><Button type="submit" loading={pwd.pending}>Changer le mot de passe</Button></div>
          </form>
        </Card>
        {allowDelete && (
          <Card>
            <CardHeader title="Supprimer mon compte" description="Vos données personnelles sont anonymisées. Les éléments financiers et l'historique sont conservés." />
            <div className="p-5">
              <Button variant="danger" onClick={() => setDeleteOpen(true)}>Supprimer mon compte</Button>
            </div>
            <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Supprimer définitivement mon compte" description="Cette action est irréversible. Confirmez avec votre mot de passe." size="sm">
              <form onSubmit={remove} className="flex flex-col gap-4">
                <Input label="Mot de passe" name="password" type="password" required autoComplete="current-password" />
                {deleteError && <Notice tone="danger">{deleteError}</Notice>}
                <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setDeleteOpen(false)}>Annuler</Button><Button type="submit" variant="danger" loading={deleting}>Supprimer</Button></div>
              </form>
            </Modal>
          </Card>
        )}
      </div>
    </div>
  );
}
