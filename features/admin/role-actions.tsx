"use client";

import { useState } from "react";
import { ActionButton } from "@/components/ui/action";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { useAction } from "@/hooks/use-action";

export function AssignRole({ roles, admins }: { roles: { code: string; name: string }[]; admins: { id: string; name: string }[] }) {
  const { run, pending } = useAction();
  const [open, setOpen] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const res = await run(`/api/admin/users/${String(fd.get("userId"))}`, { method: "PATCH", body: { role: String(fd.get("role")), grant: true } }, { success: "Rôle attribué" });
    if (res !== undefined) setOpen(false);
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>Attribuer un rôle</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Attribuer un rôle plateforme" description="Les droits sont contrôlés côté serveur sur chaque action. Seuls les comptes administrateurs reçoivent des rôles plateforme.">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Select label="Administrateur" name="userId" required>{admins.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select>
          <Select label="Rôle" name="role" required>{roles.map((r) => <option key={r.code} value={r.code}>{r.name}</option>)}</Select>
          <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setOpen(false)}>Annuler</Button><Button type="submit" loading={pending}>Attribuer</Button></div>
        </form>
      </Modal>
    </>
  );
}

export function RevokeRole({ userId, role, name }: { userId: string; role: string; name: string }) {
  return <ActionButton endpoint={`/api/admin/users/${userId}`} method="PATCH" body={{ role, grant: false }} label="Retirer" success="Rôle retiré" confirm={{ title: `Retirer ce rôle à ${name} ?`, description: "Ses droits sont réduits immédiatement." }} />;
}
