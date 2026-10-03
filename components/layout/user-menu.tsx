"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/ui/misc";
import { CaretDown, SignOut, House, Bell } from "@/components/ui/icons";
import { api } from "@/lib/api-client";

export type MenuUser = { name: string; email: string; accountType: "CLIENT" | "LENDER" | "ADMIN"; spaceHref: string; spaceLabel: string; unread: number };

export function UserMenu({ user }: { user: MenuUser }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, []);

  async function logout() {
    await api("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    router.push("/");
    router.refresh();
  }

  const notifHref = user.accountType === "CLIENT" ? "/mes-notifications" : user.accountType === "LENDER" ? "/loueur/notifications" : "/admin/notifications";

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-haspopup="menu" className="flex h-11 items-center gap-2 rounded-full border border-line bg-surface pl-1 pr-3 transition hover:bg-surface-2">
        <Avatar name={user.name} size={34} />
        <span className="hidden max-w-[9rem] truncate text-sm font-medium text-ink lg:block">{user.name}</span>
        <CaretDown size={14} className="text-muted" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-[calc(100%+8px)] z-50 w-64 rounded-card border border-line bg-surface p-2 shadow-card">
          <div className="border-b border-line px-3 pb-2 pt-1">
            <p className="truncate text-sm font-semibold text-ink">{user.name}</p>
            <p className="truncate text-xs text-muted">{user.email}</p>
          </div>
          <Link role="menuitem" href={user.spaceHref} onClick={() => setOpen(false)} className="mt-1 flex h-10 items-center gap-2 rounded-control px-3 text-sm text-ink hover:bg-surface-2">
            <House size={18} /> {user.spaceLabel}
          </Link>
          <Link role="menuitem" href={notifHref} onClick={() => setOpen(false)} className="flex h-10 items-center justify-between rounded-control px-3 text-sm text-ink hover:bg-surface-2">
            <span className="flex items-center gap-2">
              <Bell size={18} /> Notifications
            </span>
            {user.unread > 0 && <span className="rounded-full bg-royal px-2 text-xs font-semibold text-white">{user.unread}</span>}
          </Link>
          <button role="menuitem" type="button" onClick={logout} className="flex h-10 w-full items-center gap-2 rounded-control px-3 text-left text-sm text-ink hover:bg-surface-2">
            <SignOut size={18} /> Se déconnecter
          </button>
        </div>
      )}
    </div>
  );
}
