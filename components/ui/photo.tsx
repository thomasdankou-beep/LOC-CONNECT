"use client";

import { useState } from "react";
import { ImageIcon } from "./icons";
import { cn } from "@/lib/cn";

/** Redimensionne les photos de démonstration pour ne pas charger du 1200 px dans une vignette. */
export function sized(url: string | null | undefined, w: number, h: number): string | null {
  if (!url) return null;
  if (url.includes("images.unsplash.com")) return url.replace(/([?&])w=\d+/, `$1w=${w}`).replace(/([?&])h=\d+/, `$1h=${h}`);
  return url.replace(/\/seed\/(.+)\/(\d+)\/(\d+)$/, `/seed/$1/${w}/${h}`);
}

/** Image avec repli : si la photo ne charge pas, une surface neutre avec icône évite un cadre cassé. */
export function Photo({ src, alt, w = 800, h = 600, className, priority }: { src?: string | null; alt: string; w?: number; h?: number; className?: string; priority?: boolean }) {
  const [failed, setFailed] = useState(false);
  const url = sized(src, w, h);
  if (!url || failed) {
    return (
      <div className={cn("flex items-center justify-center bg-surface-2 text-muted", className)} role="img" aria-label={alt}>
        <ImageIcon size={28} />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={alt} width={w} height={h} loading={priority ? "eager" : "lazy"} decoding="async" fetchPriority={priority ? "high" : "auto"} onError={() => setFailed(true)} className={cn("bg-surface-2 object-cover", className)} />
  );
}
