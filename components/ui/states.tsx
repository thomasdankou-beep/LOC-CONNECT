import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} aria-hidden />;
}

export function EmptyState({ icon, title, description, action, className }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-card border border-dashed border-line bg-surface px-6 py-14 text-center", className)}>
      {icon && <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-royal-soft text-royal-ink">{icon}</div>}
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      {description && <p className="mt-1 max-w-md text-sm text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ title = "Une erreur est survenue", description, action }: { title?: string; description?: string; action?: ReactNode }) {
  return (
    <div role="alert" className="rounded-card border border-danger/30 bg-danger-soft px-6 py-8 text-center">
      <h3 className="text-base font-semibold text-danger">{title}</h3>
      {description && <p className="mx-auto mt-1 max-w-md text-sm text-ink">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Notice({ tone = "info", title, children }: { tone?: "info" | "warning" | "danger" | "success"; title?: string; children: ReactNode }) {
  const styles = { info: "border-royal/25 bg-royal-soft", warning: "border-warn/30 bg-warn-soft", danger: "border-danger/30 bg-danger-soft", success: "border-success/30 bg-success-soft" };
  return (
    <div className={cn("rounded-card border px-4 py-3 text-sm", styles[tone])}>
      {title && <p className="font-semibold text-ink">{title}</p>}
      <div className="text-ink/90">{children}</div>
    </div>
  );
}

/** Squelette des espaces connectés : titre, rangée d'indicateurs et tableau. */
export function DashboardSkeleton() {
  return (
    <div role="status" aria-label="Chargement">
      <Skeleton className="h-9 w-64" />
      <Skeleton className="mt-3 h-5 w-full max-w-lg" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}
      </div>
      <Skeleton className="mt-8 h-72 w-full" />
    </div>
  );
}
