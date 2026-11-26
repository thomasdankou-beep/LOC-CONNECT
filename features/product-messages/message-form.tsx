"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { Camera } from "@/components/ui/icons";
import { useAction } from "@/hooks/use-action";
import { newIdempotencyKey } from "@/lib/api-client";
import { MAX_MESSAGE_LENGTH, MAX_MESSAGE_PHOTOS, type MessageTarget } from "@/lib/product-messages";

export function RefreshMessages() {
  const router = useRouter();
  useEffect(() => {
    function refresh() {
      if (document.visibilityState === "visible") router.refresh();
    }
    const timer = window.setInterval(refresh, 20000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [router]);
  return null;
}

export function ProductMessageForm({ target, basePath }: { target: MessageTarget; basePath: string }) {
  const router = useRouter();
  const { run, pending, error } = useAction();
  const [ready, setReady] = useState(false);
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const requestId = useRef("");
  const sending = useRef(false);
  useEffect(() => { setReady(true); }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending.current || files.length > MAX_MESSAGE_PHOTOS || (!body.trim() && !files.length)) return;
    sending.current = true;
    try {
      requestId.current ||= newIdempotencyKey();
      const form = new FormData();
      if ("productId" in target) form.set("productId", target.productId);
      else form.set("conversationId", target.conversationId);
      form.set("requestId", requestId.current);
      form.set("body", body);
      for (const file of files) form.append("photos", file);
      const sent = await run<{ conversationId: string }>("/api/product-messages", { form }, { success: "Message envoyé", silentError: true, refresh: false });
      if (!sent) return;
      requestId.current = "";
      setBody("");
      setFiles([]);
      if (input.current) input.current.value = "";
      router.replace(basePath + "/" + sent.conversationId, { scroll: false });
      router.refresh();
    } finally {
      sending.current = false;
    }
  }

  return (
    <form method="post" onSubmit={submit} className="space-y-3 rounded-card border border-line bg-surface p-4 sm:p-5">
      <Textarea label="Votre message" name="body" value={body} maxLength={MAX_MESSAGE_LENGTH} disabled={pending} rows={3}
        placeholder={"productId" in target ? "Quelle information souhaitez-vous sur cet article ?" : "Écrivez votre réponse…"}
        onChange={(e) => { requestId.current = ""; setBody(e.target.value); }} />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-control border border-line px-3 text-sm font-medium focus-within:ring-2 focus-within:ring-royal">
            <Camera size={20} aria-hidden /> Joindre des photos
            <input ref={input} type="file" multiple accept="image/jpeg,image/png,image/webp" disabled={pending} className="sr-only"
              onChange={(e) => { requestId.current = ""; setFiles(Array.from(e.target.files ?? [])); }} />
          </label>
          <p className="mt-1 text-xs text-muted">JPG, PNG ou WebP · 3 photos maximum · 6 Mo par photo</p>
        </div>
        <Button type="submit" loading={pending} disabled={!ready || (!body.trim() && !files.length) || files.length > MAX_MESSAGE_PHOTOS}>Envoyer</Button>
      </div>
      {files.length > 0 && <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="min-w-0 break-all text-muted">{files.map((file) => file.name).join(", ")}</span>
        <button type="button" disabled={pending} className="font-medium text-royal-ink underline" onClick={() => {
          requestId.current = ""; setFiles([]); if (input.current) input.current.value = "";
        }}>Retirer les photos</button>
      </div>}
      {files.length > MAX_MESSAGE_PHOTOS && <p role="alert" className="text-sm text-danger">Choisissez trois photos au maximum.</p>}
      {error && <p role="alert" className="text-sm text-danger">{error.message}</p>}
    </form>
  );
}
