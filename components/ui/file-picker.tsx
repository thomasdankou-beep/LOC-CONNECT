"use client";

import { useId, useState } from "react";
import { UploadSimple } from "./icons";

/** Sélecteur de fichiers localisé (le champ natif affiche « Choose files » selon le navigateur). */
export function FilePicker({ name, label, accept = "image/jpeg,image/png,image/webp", multiple = false, hint, onCount }: { name: string; label: string; accept?: string; multiple?: boolean; hint?: string; onCount?: (n: number) => void }) {
  const id = useId();
  const [names, setNames] = useState<string[]>([]);
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-ink">{label}</span>
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor={id} className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-control border border-line bg-surface px-3.5 text-sm font-medium text-ink transition hover:bg-surface-2 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-royal">
          <UploadSimple size={18} /> {multiple ? "Choisir des photos" : "Choisir un fichier"}
          <input
            id={id}
            type="file"
            name={name}
            accept={accept}
            multiple={multiple}
            className="sr-only"
            onChange={(e) => {
              const files = [...(e.target.files ?? [])];
              setNames(files.map((f) => f.name));
              onCount?.(files.length);
            }}
          />
        </label>
        <span className="min-w-0 truncate text-sm text-muted" aria-live="polite">{names.length === 0 ? "Aucun fichier choisi" : names.length === 1 ? names[0] : `${names.length} fichiers choisis`}</span>
      </div>
      {hint && <p className="text-sm text-muted">{hint}</p>}
    </div>
  );
}
