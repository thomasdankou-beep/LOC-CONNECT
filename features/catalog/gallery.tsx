"use client";

import { useState } from "react";
import { Photo } from "@/components/ui/photo";
import { cn } from "@/lib/cn";

export function Gallery({ photos, name }: { photos: { url: string; alt: string | null }[]; name: string }) {
  const [index, setIndex] = useState(0);
  const current = photos[index];
  return (
    <div>
      <div className="overflow-hidden rounded-card border border-line bg-surface-2">
        <Photo src={current?.url} alt={current?.alt ?? name} w={1200} h={900} priority className="aspect-[4/3] w-full" />
      </div>
      {photos.length > 1 && (
        <ul className="mt-3 grid grid-cols-4 gap-3" aria-label="Photos du produit">
          {photos.map((p, i) => (
            <li key={p.url}>
              <button type="button" onClick={() => setIndex(i)} aria-label={`Voir la photo ${i + 1}`} aria-current={i === index} className={cn("block w-full overflow-hidden rounded-control border-2 transition", i === index ? "border-royal" : "border-transparent opacity-80 hover:opacity-100")}>
                <Photo src={p.url} alt="" w={300} h={225} className="aspect-[4/3] w-full" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
