import Link from "next/link";
import type { ReactNode } from "react";
import type { Actor } from "@/lib/auth/actor";
import { unreadCount } from "@/services/notifications";
import { maybeRunMaintenance } from "@/services/maintenance";
import { Avatar } from "@/components/ui/misc";
import { Bell, ArrowUpRight } from "@/components/ui/icons";
import { Logo } from "./logo";
import { MobileMenuButton, SidebarNav, type NavGroup } from "./sidebar-nav";
import { UserMenu } from "./user-menu";

/**
 * Gabarit des espaces connectés (client, loueur, administration) : barre latérale marine, barre supérieure avec notifications
 * et menu utilisateur. Sur mobile, la barre latérale devient un tiroir.
 */
export async function DashboardShell({ actor, groups, area, notificationsHref, spaceHref, spaceLabel, children }: { actor: Actor; groups: NavGroup[]; area: string; notificationsHref: string; spaceHref: string; spaceLabel: string; children: ReactNode }) {
  void maybeRunMaintenance();
  const unread = await unreadCount(actor.userId);
  const name = `${actor.firstName} ${actor.lastName}`.trim();
  return (
    <div className="min-h-dvh">
      <SidebarNav
        groups={groups}
        header={<Logo inverse href="/" />}
        footer={
          <div className="space-y-2">
            <Link href="/" className="flex h-10 items-center justify-between rounded-control px-3 text-sm text-white/75 transition hover:bg-white/8 hover:text-white">
              Voir le site <ArrowUpRight size={16} />
            </Link>
            <div className="flex items-center gap-3 rounded-control bg-white/8 px-3 py-2.5">
              <Avatar name={name} size={36} className="bg-white/15 text-white" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white">{name}</p>
                <p className="truncate text-xs text-white/60">{actor.lenderName ?? area}</p>
              </div>
            </div>
          </div>
        }
      >
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-line bg-canvas/90 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-3">
            <MobileMenuButton />
            <p className="text-sm font-medium text-muted">{area}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href={notificationsHref} className="relative flex size-11 items-center justify-center rounded-control border border-line bg-surface text-ink transition hover:bg-surface-2" aria-label={`Notifications, ${unread} non lue${unread > 1 ? "s" : ""}`}>
              <Bell size={22} />
              {unread > 0 && <span className="absolute -right-1.5 -top-1.5 flex min-w-5 items-center justify-center rounded-full bg-royal px-1 text-xs font-semibold text-white">{unread > 99 ? "99+" : unread}</span>}
            </Link>
            <UserMenu user={{ name, email: actor.email, accountType: actor.accountType, spaceHref, spaceLabel, unread }} />
          </div>
        </header>
        <main id="contenu" className="mx-auto max-w-[88rem] px-4 py-8 sm:px-6">
          {children}
        </main>
      </SidebarNav>
    </div>
  );
}
