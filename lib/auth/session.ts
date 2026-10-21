import { SignJWT, jwtVerify } from "jose";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import { db, type DbOrTx } from "../db";
import { env } from "../env";
import { addHours } from "../dates";
import type { RequestMeta } from "../audit";

export const SESSION_COOKIE = "lc_session";

const secret = () => new TextEncoder().encode(env().AUTH_SECRET);

export async function requestMeta(): Promise<RequestMeta> {
  try {
    const h = await headers();
    const fwd = h.get("x-forwarded-for");
    return { ip: fwd ? fwd.split(",")[0].trim() : h.get("x-real-ip"), userAgent: h.get("user-agent") };
  } catch {
    return {};
  }
}

export async function startSession(userId: string, meta: RequestMeta): Promise<{ token: string; expiresAt: Date }> {
  const expiresAt = addHours(new Date(), env().SESSION_TTL_HOURS);
  const session = await db.session.create({
    data: { userId, expiresAt, ip: meta.ip ?? null, userAgent: meta.userAgent?.slice(0, 300) ?? null },
  });
  const token = await new SignJWT({ sid: session.id })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(secret());
  return { token, expiresAt };
}

export async function setSessionCookie(token: string, expiresAt: Date): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

export type SessionInfo = { sessionId: string; userId: string };

/** Lit et vérifie la session : signature JWT, puis session non révoquée et non expirée en base. */
export const readSession = cache(async (): Promise<SessionInfo | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    const sid = payload.sid;
    if (typeof sid !== "string" || !payload.sub) return null;
    const session = await db.session.findUnique({ where: { id: sid } });
    if (!session || session.revokedAt || session.expiresAt < new Date() || session.userId !== payload.sub) return null;
    return { sessionId: sid, userId: session.userId };
  } catch {
    return null;
  }
});

export async function revokeSession(sessionId: string): Promise<void> {
  await db.session.updateMany({ where: { id: sessionId, revokedAt: null }, data: { revokedAt: new Date() } });
}

/** Révoque toutes les sessions d'un utilisateur (désactivation, suspension, changement de mot de passe). */
export async function revokeUserSessions(client: DbOrTx, userId: string): Promise<void> {
  await client.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
}
