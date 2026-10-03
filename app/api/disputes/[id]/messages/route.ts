import { created, route } from "@/lib/http/route";
import { AppError } from "@/lib/errors";
import { requireActor } from "@/lib/auth/actor";
import { saveUpload, ALLOWED_ATTACHMENT_TYPES } from "@/lib/storage";
import { addMessage } from "@/services/disputes";

/** POST /api/disputes/:id/messages : message et pièces jointes (multipart : `message`, `files`). Pièces privées. */
export const POST = route<{ id: string }>(async ({ req, params }) => {
  const actor = await requireActor();
  const contentType = req.headers.get("content-type") ?? "";
  let message = "";
  const files: File[] = [];
  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    message = String(form.get("message") ?? "").trim();
    for (const f of form.getAll("files")) if (f instanceof File && f.size > 0) files.push(f);
  } else {
    message = String(((await req.json()) as { message?: string }).message ?? "").trim();
  }
  if (message.length < 2 || message.length > 2000) throw new AppError("VALIDATION_ERROR", "Le message doit contenir entre 2 et 2000 caractères.");
  if (files.length > 5) throw new AppError("VALIDATION_ERROR", "5 pièces jointes maximum.");
  const stored = [];
  for (const f of files) {
    const s = await saveUpload(f, `disputes/${params.id}`, "private", ALLOWED_ATTACHMENT_TYPES);
    stored.push({ key: s.key, fileName: f.name.slice(0, 120), mimeType: s.mimeType, size: s.size });
  }
  return created(await addMessage(actor, params.id, message, stored));
});
