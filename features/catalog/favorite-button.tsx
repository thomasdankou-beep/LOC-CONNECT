"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api-client";
import { Heart } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { useToast } from "@/components/ui/toast";

export function FavoriteButton({ productId, initial, signedIn, className }: { productId: string; initial: boolean; signedIn: boolean; className?: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [fav, setFav] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (!signedIn) return router.push(`/connexion?next=${encodeURIComponent(location.pathname + location.search)}`);
    setBusy(true);
    try {
      await api(`/api/favorites/${productId}`, { method: fav ? "DELETE" : "POST" });
      setFav(!fav);
      router.refresh();
    } catch {
      toast({ tone: "error", title: "Les favoris sont réservés aux comptes client." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" onClick={toggle} disabled={busy} aria-pressed={fav} aria-label={fav ? "Retirer des favoris" : "Ajouter aux favoris"} className={cn("flex size-10 items-center justify-center rounded-full bg-surface/95 text-ink shadow-card transition hover:scale-105", fav && "text-danger", className)}>
      <Heart size={20} weight={fav ? "fill" : "regular"} />
    </button>
  );
}
