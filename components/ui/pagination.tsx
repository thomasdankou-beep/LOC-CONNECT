import Link from "next/link";
import { CaretLeft, CaretRight } from "./icons";
import { cn } from "@/lib/cn";

function href(basePath: string, params: Record<string, string | undefined>, page: number) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
  if (page > 1) sp.set("page", String(page));
  const qs = sp.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

export function Pagination({ page, totalPages, basePath, params = {} }: { page: number; totalPages: number; basePath: string; params?: Record<string, string | undefined> }) {
  if (totalPages <= 1) return null;
  const pages = new Set([1, totalPages, page - 1, page, page + 1]);
  const list = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  const cell = "inline-flex size-10 items-center justify-center rounded-control text-sm transition";
  return (
    <nav aria-label="Pagination" className="mt-8 flex items-center justify-center gap-1.5">
      {page > 1 ? (
        <Link href={href(basePath, params, page - 1)} className={cn(cell, "border border-line bg-surface hover:bg-surface-2")} aria-label="Page précédente">
          <CaretLeft size={16} />
        </Link>
      ) : null}
      {list.map((p, i) => (
        <span key={p} className="flex items-center gap-1.5">
          {i > 0 && p - list[i - 1] > 1 && <span className="px-1 text-muted">...</span>}
          <Link href={href(basePath, params, p)} aria-current={p === page ? "page" : undefined} className={cn(cell, p === page ? "bg-royal font-semibold text-white" : "border border-line bg-surface hover:bg-surface-2")}>
            {p}
          </Link>
        </span>
      ))}
      {page < totalPages ? (
        <Link href={href(basePath, params, page + 1)} className={cn(cell, "border border-line bg-surface hover:bg-surface-2")} aria-label="Page suivante">
          <CaretRight size={16} />
        </Link>
      ) : null}
    </nav>
  );
}
