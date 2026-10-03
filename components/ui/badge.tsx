import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { Tone } from "@/lib/labels";

const TONES: Record<Tone, string> = {
  neutral: "bg-surface-2 text-muted",
  info: "bg-royal-soft text-royal-ink",
  success: "bg-success-soft text-success",
  warning: "bg-warn-soft text-warn",
  danger: "bg-danger-soft text-danger",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium", TONES[tone], className)}>{children}</span>;
}

/** Badge de statut : toujours un libellé en toutes lettres, jamais la couleur seule. */
export function StatusBadge({ entry }: { entry: { label: string; tone: Tone } | undefined }) {
  if (!entry) return null;
  return <Badge tone={entry.tone}>{entry.label}</Badge>;
}
