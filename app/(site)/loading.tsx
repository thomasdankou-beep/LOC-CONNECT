import { Skeleton } from "@/components/ui/states";

export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6" role="status" aria-label="Chargement">
      <Skeleton className="h-10 w-72" />
      <Skeleton className="mt-4 h-5 w-full max-w-xl" />
      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-64 w-full" />)}
      </div>
    </div>
  );
}
