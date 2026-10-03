"use client";

import { useRef, useState } from "react";
import { useAction } from "@/hooks/use-action";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { UploadSimple } from "@/components/ui/icons";

export function DisputeMessageForm({ disputeId }: { disputeId: string }) {
  const { run, pending, error } = useAction();
  const [files, setFiles] = useState<File[]>([]);
  const formRef = useRef<HTMLFormElement>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData();
    fd.set("message", String(new FormData(e.currentTarget).get("message") ?? ""));
    for (const f of files) fd.append("files", f);
    const res = await run(`/api/disputes/${disputeId}/messages`, { form: fd }, { success: "Message envoyé", silentError: true });
    if (res !== undefined) {
      formRef.current?.reset();
      setFiles([]);
    }
  }

  return (
    <form ref={formRef} onSubmit={submit} className="space-y-3">
      <Textarea label="Votre message" name="message" required minLength={2} maxLength={2000} rows={3} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-control border border-line px-3 text-sm text-ink hover:bg-surface-2">
          <UploadSimple size={18} /> Joindre des fichiers
          <input type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf" className="sr-only" onChange={(e) => setFiles([...(e.target.files ?? [])].slice(0, 5))} />
        </label>
        <Button type="submit" loading={pending}>Envoyer</Button>
      </div>
      {files.length > 0 && <p className="text-xs text-muted">{files.map((f) => f.name).join(", ")}</p>}
      {error && <p role="alert" className="text-sm text-danger">{error.message}</p>}
    </form>
  );
}
