import { PageShell } from "@/components/layout/page-shell";
import { ProductCardSkeleton } from "@/features/catalog/product-card";
import { Skeleton } from "@/components/ui/states";

export default function Loading() {
  return (
    <PageShell title="Catalogue">
      <div className="grid gap-8 lg:grid-cols-[19rem_1fr]">
        <Skeleton className="hidden h-[34rem] rounded-card lg:block" />
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </PageShell>
  );
}
