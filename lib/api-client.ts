/** Client HTTP des composants navigateur. Les erreurs API normalisées deviennent des ApiError exploitables par l'interface. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
    readonly details?: { path: string; message: string }[],
  ) {
    super(message);
  }
}

type Options = { method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE"; body?: unknown; form?: FormData };

export async function api<T = unknown>(path: string, opts: Options = {}): Promise<T> {
  const init: RequestInit = { method: opts.method ?? (opts.body || opts.form ? "POST" : "GET"), credentials: "same-origin" };
  if (opts.form) init.body = opts.form;
  else if (opts.body !== undefined) {
    init.body = JSON.stringify(opts.body);
    init.headers = { "Content-Type": "application/json" };
  }
  let res: Response;
  try {
    res = await fetch(path, init);
  } catch {
    throw new ApiError("Connexion impossible. Vérifiez votre réseau et réessayez.", "NETWORK", 0);
  }
  let json: { success?: boolean; data?: T; error?: { code: string; message: string; details?: { path: string; message: string }[] } } | null = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  if (!res.ok || !json?.success) {
    throw new ApiError(json?.error?.message ?? "Une erreur est survenue.", json?.error?.code ?? "INTERNAL_ERROR", res.status, json?.error?.details);
  }
  return json.data as T;
}

export const newIdempotencyKey = (): string => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
