import Link from "next/link";
import { cn } from "@/lib/cn";

export function Logo({ className, inverse, href = "/" }: { className?: string; inverse?: boolean; href?: string }) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2.5", className)} aria-label="LOC'CONNECT, accueil">
      <span className="flex size-9 items-center justify-center rounded-control bg-royal text-[15px] font-bold tracking-tight text-white">LC</span>
      <span className={cn("text-lg font-semibold tracking-tight", inverse ? "text-white" : "text-ink")}>
        LOC<span className={inverse ? "text-white" : "text-royal-ink"}>&apos;</span>CONNECT
      </span>
    </Link>
  );
}
