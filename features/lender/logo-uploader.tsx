"use client";

import { useAction } from "@/hooks/use-action";
import { Trash, UploadSimple } from "@/components/ui/icons";

/** Logo de l'entreprise : page publique et en-tête des proformas et factures. */
export function LogoUploader({ logoUrl, disabled }: { logoUrl: string | null; disabled?: boolean }) {
  const { run, pending } = useAction();

  async function upload(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    const form = new FormData();
    form.set("file", file);
    await run("/api/lenders/me/logo", { form }, { success: "Logo enregistré" });
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="flex size-20 items-center justify-center overflow-hidden rounded-control border border-line bg-surface-2">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="Logo de l'entreprise" className="size-full object-contain" />
        ) : (
          <span className="text-xs text-muted">Aucun logo</span>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <label className={`inline-flex h-9 cursor-pointer items-center gap-2 rounded-control border border-line bg-surface px-3 text-sm font-medium text-ink hover:bg-surface-2 ${disabled || pending ? "pointer-events-none opacity-50" : ""}`}>
          <UploadSimple size={16} /> {logoUrl ? "Changer le logo" : "Ajouter un logo"}
          <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={disabled || pending} onChange={(e) => upload(e.target.files)} />
        </label>
        {logoUrl && (
          <button type="button" disabled={disabled || pending} onClick={() => run("/api/lenders/me/logo", { method: "DELETE" }, { success: "Logo retiré" })} className="inline-flex h-9 items-center gap-2 rounded-control px-3 text-sm font-medium text-danger hover:bg-surface-2 disabled:opacity-50">
            <Trash size={16} /> Retirer
          </button>
        )}
      </div>
    </div>
  );
}
