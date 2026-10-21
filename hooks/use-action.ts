"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { api, ApiError } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";

type RunOptions<T> = { success?: string; refresh?: boolean; onSuccess?: (data: T) => void; silentError?: boolean };

/** Exécute une mutation API avec état de chargement, message d'erreur lisible, toast et rafraîchissement des données serveur. */
export function useAction() {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const run = useCallback(
    async <T,>(path: string, call: { method?: "POST" | "PATCH" | "PUT" | "DELETE"; body?: unknown; form?: FormData }, opts: RunOptions<T> = {}): Promise<T | undefined> => {
      setPending(true);
      setError(null);
      try {
        const data = await api<T>(path, call);
        if (opts.success) toast({ tone: "success", title: opts.success });
        opts.onSuccess?.(data);
        if (opts.refresh !== false) router.refresh();
        return data;
      } catch (e) {
        const err = e instanceof ApiError ? e : new ApiError("Une erreur est survenue.", "INTERNAL_ERROR", 500);
        setError(err);
        if (!opts.silentError) toast({ tone: "error", title: err.message });
        return undefined;
      } finally {
        setPending(false);
      }
    },
    [router, toast],
  );
  return { run, pending, error };
}
