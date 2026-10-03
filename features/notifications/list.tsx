"use client";

import Link from "next/link";
import { useAction } from "@/hooks/use-action";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { Bell } from "@/components/ui/icons";
import { cn } from "@/lib/cn";

type N = { id: string; title: string; body: string; link: string | null; readAt: string | null; createdAt: string };

export function NotificationList({ items }: { items: N[] }) {
  const { run, pending } = useAction();
  const unread = items.filter((n) => !n.readAt).length;
  if (items.length === 0) return <EmptyState icon={<Bell size={24} />} title="Aucune notification" description="Les événements importants de vos réservations apparaîtront ici." />;
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted">{unread} non lue{unread > 1 ? "s" : ""}</p>
        {unread > 0 && <Button variant="secondary" size="sm" loading={pending} onClick={() => run("/api/me/notifications", { body: {} })}>Tout marquer comme lu</Button>}
      </div>
      <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface shadow-card">
        {items.map((n) => (
          <li key={n.id}>
            <Link href={n.link ?? "#"} onClick={() => !n.readAt && void fetch("/api/me/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: n.id }) })} className={cn("flex gap-3 px-5 py-4 transition hover:bg-surface-2/50", !n.readAt && "bg-royal-soft/40")}>
              <span className={cn("mt-2 size-2 shrink-0 rounded-full", n.readAt ? "bg-transparent" : "bg-royal")} aria-hidden />
              <div className="min-w-0">
                <p className={cn("text-[15px]", n.readAt ? "text-ink" : "font-semibold text-ink")}>{n.title}</p>
                <p className="mt-0.5 text-sm text-muted">{n.body}</p>
                <p className="mt-1 text-xs text-muted">{new Date(n.createdAt).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
