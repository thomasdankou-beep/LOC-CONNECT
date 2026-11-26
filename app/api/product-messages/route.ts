import { requireActor } from "@/lib/auth/actor";
import { invalid } from "@/lib/errors";
import { created, route } from "@/lib/http/route";
import { MAX_MESSAGE_PHOTOS } from "@/lib/product-messages";
import { MAX_UPLOAD_BYTES } from "@/lib/storage";
import { sendProductMessage } from "@/services/product-messages";

export const POST = route(async ({ req }) => {
  const actor = await requireActor();
  if (!req.headers.get("content-type")?.includes("multipart/form-data")) throw invalid("Formulaire de message invalide.");
  if (Number(req.headers.get("content-length")) > MAX_MESSAGE_PHOTOS * MAX_UPLOAD_BYTES + 128 * 1024) {
    throw invalid("Les photos dépassent la taille autorisée.");
  }
  const form = await req.formData();
  const productId = form.get("productId");
  const conversationId = form.get("conversationId");
  const target = typeof productId === "string" && productId && conversationId === null ? { productId }
    : typeof conversationId === "string" && conversationId && productId === null ? { conversationId } : null;
  if (!target) throw invalid("Sélectionnez un article ou une conversation.");
  const body = form.get("body");
  const requestId = form.get("requestId");
  if (typeof requestId !== "string" || (body !== null && typeof body !== "string")) throw invalid("Formulaire de message invalide.");
  const photos: File[] = [];
  for (const value of form.getAll("photos")) {
    if (!(value instanceof File)) throw invalid("Photo invalide.");
    if (value.name || value.size) photos.push(value);
  }
  return created(await sendProductMessage(actor, target, requestId, body ?? "", photos));
});
