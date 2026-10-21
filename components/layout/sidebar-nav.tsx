"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { List, X } from "@/components/ui/icons";
import { cn } from "@/lib/cn";

export type NavItem = { href: string; label: string; icon: ReactNode; badge?: number; exact?: boolean };
export type NavGroup = { title?: string; items: NavItem[] };

function Items({ groups, onNavigate }: { groups: NavGroup[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-5" aria-label="Navigation de l'espace">
      {groups.map((g, gi) => (
        <div key={gi}>
          {g.title && <p className="mb-1.5 px-3 text-xs font-semibold uppercase tracking-wide text-white/50">{g.title}</p>}
          <ul className="flex flex-col gap-0.5">
            {g.items.map((it) => {
              const active = it.exact ? pathname === it.href : pathname === it.href || pathname.startsWith(`${it.href}/`);
              return (
                <li key={it.href}>
                  <Link href={it.href} onClick={onNavigate} aria-current={active ? "page" : undefined} className={cn("flex h-10 items-center gap-3 rounded-control px-3 text-[15px] transition", active ? "bg-white/14 font-medium text-white" : "text-white/75 hover:bg-white/8 hover:text-white")}>
                    <span className="shrink-0">{it.icon}</span>
                    <span className="flex-1 truncate">{it.label}</span>
                    {it.badge ? <span className="rounded-full bg-royal px-2 text-xs font-semibold text-white">{it.badge}</span> : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

const MenuCtx = createContext<{ open: boolean; setOpen: (v: boolean) => void } | null>(null);

/** Bouton de menu mobile : placé dans la barre supérieure, pilote le tiroir de la barre latérale. */
export function MobileMenuButton() {
  const ctx = useContext(MenuCtx);
  return (
    <button type="button" onClick={() => ctx?.setOpen(true)} className="flex size-11 items-center justify-center rounded-control border border-line bg-surface lg:hidden" aria-label="Ouvrir le menu" aria-expanded={ctx?.open}>
      <List size={22} />
    </button>
  );
}

export function SidebarNav({ groups, header, footer, children }: { groups: NavGroup[]; header: ReactNode; footer: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <MenuCtx.Provider value={{ open, setOpen }}>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-navy px-3 py-4 lg:flex">
        <div className="px-2 pb-5">{header}</div>
        <div className="flex-1 overflow-y-auto pr-1">
          <Items groups={groups} />
        </div>
        <div className="mt-3 border-t border-white/10 pt-3">{footer}</div>
      </aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu de navigation">
          <div className="absolute inset-0 bg-navy/60" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-navy px-3 py-4">
            <div className="flex items-center justify-between px-2 pb-5">
              {header}
              <button type="button" onClick={() => setOpen(false)} className="flex size-10 items-center justify-center rounded-control text-white hover:bg-white/10" aria-label="Fermer le menu">
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <Items groups={groups} onNavigate={() => setOpen(false)} />
            </div>
            <div className="mt-3 border-t border-white/10 pt-3">{footer}</div>
          </div>
        </div>
      )}
      <div className="lg:pl-64">{children}</div>
    </MenuCtx.Provider>
  );
}
