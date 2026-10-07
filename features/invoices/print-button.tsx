"use client";

import { Printer } from "@/components/ui/icons";

/** Ouvre la boîte d'impression du navigateur : « Enregistrer en PDF » produit le fichier, y compris sur téléphone. */
export function PrintButton({ label = "Télécharger en PDF" }: { label?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className="inline-flex h-10 items-center gap-2 rounded-[10px] bg-[#1f4fd6] px-4 text-sm font-medium text-white hover:bg-[#1a43b8]">
      <Printer size={18} /> {label}
    </button>
  );
}
