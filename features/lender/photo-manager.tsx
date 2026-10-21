"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAction } from "@/hooks/use-action";
import { Photo } from "@/components/ui/photo";
import { Trash, UploadSimple } from "@/components/ui/icons";

export function PhotoManager({ productId, photos }: { productId: string; photos: { id: string; url: string }[] }) {
  const router = useRouter();
  const { run, pending } = useAction();
  const [busy, setBusy] = useState(false);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    for (const f of [...files].slice(0, 10)) {
      const form = new FormData();
      form.set("file", f);
      await run(`/api/products/${productId}/photos`, { form }, { refresh: false });
    }
    setBusy(false);
    router.refresh();
  }

  return (
    <div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {photos.map((p, i) => (
          <li key={p.id} className="group relative overflow-hidden rounded-control border border-line">
            <Photo src={p.url} alt={`Photo ${i + 1}`} w={400} h={300} className="aspect-[4/3] w-full" />
            <button type="button" disabled={pending} onClick={() => run(`/api/products/${productId}/photos?photoId=${p.id}`, { method: "DELETE" }, { success: "Photo supprimée" })} className="absolute right-2 top-2 flex size-9 items-center justify-center rounded-full bg-surface/95 text-danger shadow-card transition hover:scale-105" aria-label={`Supprimer la photo ${i + 1}`}>
              <Trash size={16} />
            </button>
          </li>
        ))}
      </ul>
      <label className="mt-4 inline-flex">
        <span className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-control border border-line px-4 text-sm font-medium text-ink hover:bg-surface-2"><UploadSimple size={18} /> {busy ? "Envoi..." : "Ajouter des photos"}</span>
        <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={(e) => upload(e.target.files)} />
      </label>
    </div>
  );
}
