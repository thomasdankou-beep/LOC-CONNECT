"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { List, X } from "@/components/ui/icons";
import { Logo } from "./logo";

export function MobileNav({ links, cta }: { links: { href: string; label: string }[]; cta?: { href: string; label: string } }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div className="lg:hidden">
      <button type="button" onClick={() => setOpen(true)} className="flex size-11 items-center justify-center rounded-control border border-line bg-surface" aria-label="Ouvrir le menu" aria-expanded={open}>
        <List size={22} />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex flex-col bg-canvas" role="dialog" aria-modal="true" aria-label="Menu principal">
          <div className="flex h-16 items-center justify-between border-b border-line px-4">
            <Logo />
            <button type="button" onClick={() => setOpen(false)} className="flex size-11 items-center justify-center rounded-control border border-line bg-surface" aria-label="Fermer le menu">
              <X size={22} />
            </button>
          </div>
          <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-4">
            {links.map((l) => (
              <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="flex h-14 items-center rounded-card px-4 text-lg font-medium text-ink hover:bg-surface-2">
                {l.label}
              </Link>
            ))}
            {cta && (
              <Link href={cta.href} onClick={() => setOpen(false)} className="mt-4 flex h-14 items-center justify-center rounded-control bg-royal text-base font-medium text-white">
                {cta.label}
              </Link>
            )}
          </nav>
        </div>
      )}
    </div>
  );
}
