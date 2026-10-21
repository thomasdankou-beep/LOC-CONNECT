"use client";

import { useState } from "react";
import type { DeliveryStatus } from "@prisma/client";
import { ActionButton, FormAction } from "@/components/ui/action";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { FilePicker } from "@/components/ui/file-picker";
import { Modal } from "@/components/ui/modal";
import { useAction } from "@/hooks/use-action";
import { Camera } from "@/components/ui/icons";

const NEXT: Record<DeliveryStatus, { to: DeliveryStatus; label: string; variant: "primary" | "secondary" | "danger" }[]> = {
  PENDING: [{ to: "PREPARING", label: "Démarrer la préparation", variant: "primary" }],
  PREPARING: [{ to: "OUT_FOR_DELIVERY", label: "Partir en livraison", variant: "primary" }],
  OUT_FOR_DELIVERY: [{ to: "DELIVERED", label: "Marquer comme livrée", variant: "primary" }, { to: "FAILED", label: "Échec de livraison", variant: "danger" }],
  DELIVERED: [],
  FAILED: [{ to: "PREPARING", label: "Reprogrammer", variant: "secondary" }],
  RETURNED: [],
};

type Perms = { update: boolean; proof: boolean };

export function DeliveryControls({ id, status, scheduledDate, slotStart, slotEnd, itemsReady, perms }: { id: string; status: DeliveryStatus; scheduledDate: string | null; slotStart: string | null; slotEnd: string | null; itemsReady: boolean; perms: Perms }) {
  return (
    <div className="flex flex-wrap gap-2">
      {perms.update && NEXT[status].map((n) => (
        <ActionButton
          key={n.to}
          endpoint={`/api/deliveries/${id}/status`}
          method="PATCH"
          body={{ status: n.to }}
          label={n.label}
          variant={n.variant}
          disabled={n.to === "OUT_FOR_DELIVERY" && !itemsReady}
          success="Livraison mise à jour"
          confirm={n.to === "FAILED" ? { title: "Déclarer un échec de livraison ?", description: "Le client est prévenu et vous pourrez reprogrammer la livraison.", confirmLabel: "Déclarer l'échec" } : undefined}
        />
      ))}
      {perms.update && status !== "DELIVERED" && status !== "RETURNED" && (
        <FormAction
          endpoint={`/api/deliveries/${id}`}
          method="PATCH"
          label="Planifier"
          title="Planifier la livraison"
          description="Date et créneau annoncés au client."
          fields={[
            { name: "scheduledDate", label: "Date de livraison", type: "date", required: true, defaultValue: scheduledDate ?? "" },
            { name: "slotStart", label: "Début du créneau (HH:MM)", placeholder: "09:00", defaultValue: slotStart ?? "" },
            { name: "slotEnd", label: "Fin du créneau (HH:MM)", placeholder: "12:00", defaultValue: slotEnd ?? "" },
            { name: "notes", label: "Note", type: "textarea" },
          ]}
          submitLabel="Enregistrer"
          success="Livraison planifiée"
        />
      )}
      {perms.proof && <ProofButton id={id} />}
    </div>
  );
}

function ProofButton({ id }: { id: string }) {
  const { run, pending } = useAction();
  const [open, setOpen] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const file = form.get("file");
    if (file instanceof File && file.size === 0) form.delete("file");
    const res = await run(`/api/deliveries/${id}/proof`, { form }, { success: "Preuve ajoutée" });
    if (res !== undefined) setOpen(false);
  }

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}><Camera size={16} /> Preuve</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Ajouter une preuve de livraison" description="Photo de la remise ou note. Les preuves sont privées : seuls le client, vous et l'administration y accèdent.">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <FilePicker name="file" label="Photo" />
          <Textarea name="note" label="Note" rows={3} placeholder="Ex : remis en main propre au gardien" />
          <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setOpen(false)}>Annuler</Button><Button type="submit" loading={pending}>Ajouter</Button></div>
        </form>
      </Modal>
    </>
  );
}
