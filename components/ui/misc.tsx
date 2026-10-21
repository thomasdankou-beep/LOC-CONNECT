import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { formatFcfa } from "@/lib/money";
import { formatDate, formatDateTime } from "@/lib/dates";
import { Star } from "./icons";

export const Money = ({ value, className }: { value: number; className?: string }) => <span className={cn("tabular-nums", className)}>{formatFcfa(value)}</span>;
export const DateText = ({ value }: { value: Date | string }) => <time dateTime={new Date(value).toISOString()}>{formatDate(value)}</time>;
export const DateTimeText = ({ value }: { value: Date | string }) => <time dateTime={new Date(value).toISOString()}>{formatDateTime(value)}</time>;

export function Avatar({ name, size = 36, className }: { name: string; size?: number; className?: string }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("");
  return (
    <span className={cn("inline-flex shrink-0 items-center justify-center rounded-full bg-royal-soft font-semibold text-royal-ink", className)} style={{ width: size, height: size, fontSize: size * 0.38 }} aria-hidden>
      {initials || "?"}
    </span>
  );
}

export function KpiCard({ label, value, hint, icon, primary }: { label: string; value: ReactNode; hint?: ReactNode; icon?: ReactNode; primary?: boolean }) {
  return (
    <div className={cn("rounded-card border p-5 shadow-card", primary ? "border-transparent bg-royal text-white" : "border-line bg-surface")}>
      <div className="flex items-center justify-between gap-3">
        <p className={cn("text-sm font-medium", primary ? "text-white/85" : "text-muted")}>{label}</p>
        {icon && <span className={cn("flex size-9 items-center justify-center rounded-control", primary ? "bg-white/15 text-white" : "bg-royal-soft text-royal-ink")}>{icon}</span>}
      </div>
      <p className="mt-3 text-2xl font-semibold tabular-nums tracking-tight sm:text-[1.75rem]">{value}</p>
      {hint && <p className={cn("mt-1 text-sm", primary ? "text-white/80" : "text-muted")}>{hint}</p>}
    </div>
  );
}

export function Tabs({ items, active }: { items: { href: string; label: string; count?: number; key: string }[]; active: string }) {
  return (
    <div className="-mx-1 mb-5 flex gap-1 overflow-x-auto px-1 pb-1" role="tablist">
      {items.map((t) => (
        <Link key={t.key} href={t.href} role="tab" aria-selected={t.key === active} className={cn("inline-flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-medium transition", t.key === active ? "bg-navy text-white" : "border border-line bg-surface text-ink hover:bg-surface-2")}>
          {t.label}
          {t.count != null && <span className={cn("rounded-full px-1.5 text-xs", t.key === active ? "bg-white/20" : "bg-surface-2 text-muted")}>{t.count}</span>}
        </Link>
      ))}
    </div>
  );
}

export function DefinitionList({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
      {items.map((i) => (
        <div key={i.label} className="min-w-0">
          <dt className="text-xs font-medium uppercase tracking-wide text-muted">{i.label}</dt>
          <dd className="mt-0.5 break-words text-[15px] text-ink">{i.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-sm text-ink" aria-label={`Note de ${value.toFixed(1)} sur 5`}>
      <Star size={size} weight="fill" className="text-warn" aria-hidden />
      <span className="font-medium tabular-nums">{value > 0 ? value.toFixed(1) : "Nouveau"}</span>
    </span>
  );
}
