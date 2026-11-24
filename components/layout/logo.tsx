import Link from "next/link";
import { cn } from "@/lib/cn";

const artwork = "/brand/loc-connect.svg";

export function LogoArtwork({ className = "w-52" }: { className?: string }) {
  return (
    <svg viewBox="52 46 1018 227" width="1018" height="227" role="img" aria-label="LOC CONNECT — plateforme de location" className={cn("block h-auto max-w-full", className)}>
      <use href={`${artwork}#logo`} />
    </svg>
  );
}

export function Logo({ className, inverse, href = "/" }: { className?: string; inverse?: boolean; href?: string }) {
  return (
    <Link
      href={href}
      aria-label="LOC CONNECT, accueil"
      className={cn(
        "@container/logo inline-flex min-h-11 w-56 min-w-0 max-w-full items-center",
        inverse
          ? "[--lc-logo-ink:#fff] [--lc-logo-jade:#72dfbb]"
          : "dark:[--lc-logo-ink:#fff] dark:[--lc-logo-jade:#72dfbb]",
        className,
      )}
    >
      <LogoArtwork className="w-full @max-[10rem]/logo:hidden" />
      <svg viewBox="52 46 227 227" width="40" height="40" aria-hidden="true" className="hidden size-10 @max-[10rem]/logo:block">
        <use href={`${artwork}#monogramme`} />
      </svg>
    </Link>
  );
}
