import { created, route } from "@/lib/http/route";
import { AppError } from "@/lib/errors";
import { requireLender } from "@/lib/auth/actor";
import { saveUpload } from "@/lib/storage";
import { addDeliveryProof } from "@/services/deliveries";

/** POST /api/deliveries/:id/proof : preuve de livraison (photo privée, ou note). */
export const POST = route<{ id: string }>(async ({ req, params }) => {
  const actor = await requireLender("DELIVERY_PROOF_CREATE");
  const form = await req.formData();
  const file = form.get("file");
  const note = String(form.get("note") ?? "").slice(0, 500) || undefined;
  if (!(file instanceof File) && !note) throw new AppError("VALIDATION_ERROR", "Ajoutez une photo ou une note.");
  const saved = file instanceof File && file.size > 0 ? await saveUpload(file, `deliveries/${params.id}`, "private") : null;
  return created(await addDeliveryProof(actor, params.id, { key: saved?.key, type: saved ? "PHOTO" : "NOTE", note }));
});
