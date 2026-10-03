"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "./icons";
import { cn } from "@/lib/cn";

/** Boîte de dialogue accessible (élément <dialog> natif : focus piégé, Échap, fond inerte). */
export function Modal({ open, onClose, title, description, children, footer, size = "md" }: { open: boolean; onClose: () => void; title: string; description?: string; children?: ReactNode; footer?: ReactNode; size?: "sm" | "md" | "lg" }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={cn("m-auto w-[calc(100%-2rem)] rounded-card border border-line bg-surface p-0 text-ink shadow-card backdrop:bg-navy/60 backdrop:backdrop-blur-[2px]", size === "sm" ? "max-w-md" : size === "lg" ? "max-w-2xl" : "max-w-lg")}
    >
      <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
        </div>
        <button type="button" onClick={onClose} className="rounded-control p-1.5 text-muted hover:bg-surface-2" aria-label="Fermer">
          <X size={18} />
        </button>
      </div>
      <div className="max-h-[70dvh] overflow-y-auto px-5 py-4">{children}</div>
      {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-4">{footer}</div>}
    </dialog>
  );
}
