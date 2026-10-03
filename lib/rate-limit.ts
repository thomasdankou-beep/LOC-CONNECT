import { AppError } from "./errors";

/**
 * Limiteur à fenêtre glissante en mémoire.
 * Adapté à un seul processus : pour plusieurs instances, remplacer `store` par Redis (même interface).
 */
type Bucket = number[];
// Partagé via globalThis : les bundles de routes Next.js ont chacun leur copie du module.
const shared = globalThis as unknown as { __lcRateStore?: Map<string, Bucket> };
const store = (shared.__lcRateStore ??= new Map<string, Bucket>());
let lastSweep = Date.now();

function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, hits] of store) {
    if (hits.length === 0 || now - hits[hits.length - 1] > 3_600_000) store.delete(key);
  }
}

export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()): void {
  sweep(now);
  const hits = (store.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    const retryAfter = Math.max(1, Math.ceil((windowMs - (now - hits[0])) / 1000));
    store.set(key, hits);
    throw new AppError("RATE_LIMITED", "Trop de requêtes. Réessayez dans quelques instants.", { retryAfter }, { "Retry-After": String(retryAfter) });
  }
  hits.push(now);
  store.set(key, hits);
}

export function resetRateLimits(): void {
  store.clear();
}
