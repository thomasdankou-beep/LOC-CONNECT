import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { ZodError, type ZodType } from "zod";
import { AppError } from "../errors";
import { env } from "../env";
import { rateLimit } from "../rate-limit";
import { getSettings } from "../settings";

export type RouteContext<P = Record<string, string>> = { params: Promise<P> };

export type Ctx<P> = {
  req: NextRequest;
  params: P;
  requestId: string;
  ip: string;
};

type Options = {
  /** Désactive la vérification d'origine (webhooks signés, cron). */
  skipCsrf?: boolean;
  /** Désactive le rate limiting général. */
  skipRateLimit?: boolean;
};

export function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd ? fwd.split(",")[0].trim() : req.headers.get("x-real-ip")) || "local";
}

export const ok = <T>(data: T, status = 200, extra?: Record<string, unknown>) =>
  NextResponse.json({ success: true, data, ...extra }, { status });

export const created = <T>(data: T) => ok(data, 201);

function errorResponse(err: unknown, requestId: string): NextResponse {
  if (err instanceof AppError) {
    return NextResponse.json(
      { success: false, error: { code: err.code, message: err.message, request_id: requestId, ...(err.details ? { details: err.details } : {}) } },
      { status: err.status, headers: err.headers },
    );
  }
  if (err instanceof ZodError) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Certaines données sont invalides.",
          request_id: requestId,
          details: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
        },
      },
      { status: 422 },
    );
  }
  console.error(`[${requestId}]`, err);
  return NextResponse.json(
    { success: false, error: { code: "INTERNAL_ERROR", message: "Une erreur interne est survenue.", request_id: requestId } },
    { status: 500 },
  );
}

function assertSameOrigin(req: NextRequest) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return;
  const origin = req.headers.get("origin");
  if (!origin) {
    // Les clients non navigateur n'envoient pas d'Origin ; la session par cookie les rend de toute façon inopérants.
    const fetchSite = req.headers.get("sec-fetch-site");
    if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") throw new AppError("CSRF_REJECTED", "Origine de la requête refusée.");
    return;
  }
  const allowed = new Set([new URL(env().APP_URL).host, req.headers.get("host") ?? ""]);
  if (!allowed.has(new URL(origin).host)) throw new AppError("CSRF_REJECTED", "Origine de la requête refusée.");
}

/**
 * Enveloppe commune des routes API : identifiant de requête, protection CSRF (Origin), rate limiting général,
 * erreurs normalisées { success, error: { code, message, request_id } }.
 */
export function route<P = Record<string, string>>(handler: (ctx: Ctx<P>) => Promise<NextResponse>, options: Options = {}) {
  return async (req: NextRequest, routeCtx: RouteContext<P>): Promise<NextResponse> => {
    const requestId = req.headers.get("x-request-id") ?? randomUUID();
    try {
      if (!options.skipCsrf) assertSameOrigin(req);
      const ip = clientIp(req);
      if (!options.skipRateLimit) {
        const settings = await getSettings();
        rateLimit(`api:${ip}`, settings["ratelimit.api_per_minute"], 60_000);
      }
      const params = (await routeCtx?.params) ?? ({} as P);
      const res = await handler({ req, params, requestId, ip });
      res.headers.set("x-request-id", requestId);
      res.headers.set("Cache-Control", "no-store");
      return res;
    } catch (err) {
      const res = errorResponse(err, requestId);
      res.headers.set("x-request-id", requestId);
      return res;
    }
  };
}

export async function parseBody<T>(req: NextRequest, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new AppError("BAD_REQUEST", "Corps de requête JSON invalide.");
  }
  return schema.parse(raw);
}

export function parseQuery<T>(req: NextRequest, schema: ZodType<T>): T {
  const obj: Record<string, string> = {};
  req.nextUrl.searchParams.forEach((v, k) => {
    obj[k] = v;
  });
  return schema.parse(obj);
}
