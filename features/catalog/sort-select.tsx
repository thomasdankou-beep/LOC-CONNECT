"use client";

import { useRouter, useSearchParams } from "next/navigation";

const OPTIONS = [
  { value: "relevance", label: "Pertinence" },
  { value: "price_asc", label: "Prix croissant" },
  { value: "price_desc", label: "Prix décroissant" },
  { value: "rating", label: "Mieux notés" },
  { value: "newest", label: "Plus récents" },
];

export function SortSelect({ basePath = "/catalogue" }: { basePath?: string }) {
  const router = useRouter();
  const sp = useSearchParams();
  return (
    <label className="flex items-center gap-2 text-sm text-muted">
      Trier par
      <select
        value={sp.get("sort") ?? "relevance"}
        onChange={(e) => {
          const next = new URLSearchParams(sp.toString());
          next.set("sort", e.target.value);
          next.delete("page");
          router.push(`${basePath}?${next}`);
        }}
        className="h-10 rounded-control border border-line bg-surface px-3 text-sm text-ink"
      >
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}
