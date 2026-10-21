import Link from "next/link";
import { Photo } from "@/components/ui/photo";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { MapPin } from "@/components/ui/icons";
import { Stars as StarsRating } from "@/components/ui/misc";
import { formatFcfa } from "@/lib/money";
import { getSettings } from "@/lib/settings";
import { depositFloorFrom, depositLabel, depositPercentFrom } from "@/services/pricing";
import type { ProductCard as ProductCardData } from "@/services/catalog";
import { FavoriteButton } from "./favorite-button";
import { QuickAdd } from "./quick-add";


export async function ProductCard({ product, signedIn, isClient, favorite = false, start, end }: { product: ProductCardData; signedIn: boolean; isClient: boolean; favorite?: boolean; start?: string; end?: string }) {
  const p = product;
  const unavailable = p.availableQty != null && p.availableQty <= 0;
  const settings = await getSettings();
  const deposit = depositLabel(depositPercentFrom(settings), depositFloorFrom(settings), p.refundPrice);
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-card border border-line bg-surface shadow-card transition hover:-translate-y-0.5">
      <div className="relative aspect-[4/3] overflow-hidden">
        <Photo src={p.photos[0]?.url} alt={p.name} w={640} h={480} className="size-full transition duration-500 group-hover:scale-[1.03]" />
        <div className="absolute right-3 top-3 z-10">
          <FavoriteButton productId={p.id} initial={favorite} signedIn={signedIn && isClient} />
        </div>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-center justify-between gap-2 text-xs text-muted">
          <span className="truncate">{p.category.name}</span>
          {p.featured && <Badge tone="info">À la une</Badge>}
        </div>
        <h3 className="mt-1.5 line-clamp-2 text-base font-semibold leading-snug text-ink">
          <Link href={`/produits/${p.slug}`} className="after:absolute after:inset-0 after:content-['']">
            {p.name}
          </Link>
        </h3>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
          <MapPin size={14} className="shrink-0" />
          <span className="truncate">
            {p.city.name} · {p.lender.companyName}
          </span>
          {p.lender.plan !== "FREE" && <Badge tone={p.lender.plan === "PREMIUM" ? "warning" : "info"} className="relative z-10 shrink-0">{p.lender.plan === "PREMIUM" ? "Premium" : "Pro"}</Badge>}
        </p>
        <div className="mt-2 flex items-center justify-between">
          <StarsRating value={p.ratingAvg} />
          {p.availableQty != null && (
            <Badge tone={unavailable ? "danger" : "success"}>{unavailable ? "Indisponible" : `${p.availableQty} disponible${p.availableQty > 1 ? "s" : ""}`}</Badge>
          )}
        </div>
        <div className="mt-3 flex items-end justify-between border-t border-line pt-3">
          <div>
            <p className="text-lg font-semibold tabular-nums text-ink">
              {formatFcfa(p.unitPrice)} <span className="text-sm font-normal text-muted">/ jour</span>
            </p>
            <p className="text-xs text-muted">Caution : {deposit ?? formatFcfa(p.depositAmount)}</p>
          </div>
        </div>
        <div className="relative z-10 mt-4 flex gap-2">
          <LinkButton href={`/produits/${p.slug}${start && end ? `?start=${start}&end=${end}` : ""}`} size="sm" className="flex-1">
            Voir le produit
          </LinkButton>
          {(!signedIn || isClient) && <QuickAdd productId={p.id} name={p.name} start={start} end={end} stock={p.stockQuantity} signedIn={signedIn} />}
        </div>
      </div>
    </article>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface">
      <div className="skeleton aspect-[4/3] rounded-none" />
      <div className="space-y-3 p-4">
        <div className="skeleton h-3 w-1/3" />
        <div className="skeleton h-5 w-4/5" />
        <div className="skeleton h-4 w-3/5" />
        <div className="skeleton h-10 w-full" />
      </div>
    </div>
  );
}
