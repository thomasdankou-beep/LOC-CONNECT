import type { AccountType, LenderStatus } from "@prisma/client";
import { cache } from "react";
import { db } from "../db";
import { AppError, forbidden } from "../errors";
import { ALL_LENDER_PERMISSIONS } from "../rbac/permissions";
import { readSession, requestMeta } from "./session";
import type { RequestMeta } from "../audit";

export type Actor = {
  userId: string;
  accountType: AccountType;
  email: string;
  firstName: string;
  lastName: string;
  lenderId: string | null;
  lenderStatus: LenderStatus | null;
  lenderName: string | null;
  isLenderOwner: boolean;
  memberId: string | null;
  permissions: ReadonlySet<string>;
  meta: RequestMeta;
};

export const actorName = (a: Pick<Actor, "firstName" | "lastName">) => `${a.firstName} ${a.lastName}`.trim();

/** Charge l'acteur et ses permissions effectives. Un compte suspendu ou un sous-compte désactivé n'a plus aucun accès. */
export async function loadActor(userId: string, meta: RequestMeta = {}): Promise<Actor | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
      ownedLender: true,
      lenderMembership: { include: { lender: true, role: { include: { permissions: { include: { permission: true } } } } } },
    },
  });
  if (!user || user.status !== "ACTIVE" || user.anonymizedAt) return null;

  const permissions = new Set<string>();
  let lenderId: string | null = null;
  let lenderStatus: LenderStatus | null = null;
  let lenderName: string | null = null;
  let isLenderOwner = false;
  let memberId: string | null = null;

  if (user.accountType === "ADMIN") {
    for (const ur of user.roles) for (const rp of ur.role.permissions) permissions.add(rp.permission.code);
  } else if (user.accountType === "LENDER") {
    if (user.ownedLender) {
      lenderId = user.ownedLender.id;
      lenderStatus = user.ownedLender.status;
      lenderName = user.ownedLender.companyName;
      isLenderOwner = true;
      for (const code of ALL_LENDER_PERMISSIONS) permissions.add(code);
    } else if (user.lenderMembership && user.lenderMembership.status === "ACTIVE") {
      lenderId = user.lenderMembership.lenderId;
      lenderStatus = user.lenderMembership.lender.status;
      lenderName = user.lenderMembership.lender.companyName;
      memberId = user.lenderMembership.id;
      for (const rp of user.lenderMembership.role.permissions) permissions.add(rp.permission.code);
    }
  }

  return {
    userId: user.id,
    accountType: user.accountType,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    lenderId,
    lenderStatus,
    lenderName,
    isLenderOwner,
    memberId,
    permissions,
    meta,
  };
}

export const getActor = cache(async (): Promise<Actor | null> => {
  const session = await readSession();
  if (!session) return null;
  return loadActor(session.userId, await requestMeta());
});

export function can(actor: Actor, permission: string): boolean {
  return actor.permissions.has(permission);
}

export async function requireActor(): Promise<Actor> {
  const actor = await getActor();
  if (!actor) throw new AppError("UNAUTHENTICATED", "Authentification requise.");
  return actor;
}

export async function requireClient(): Promise<Actor> {
  const actor = await requireActor();
  if (actor.accountType !== "CLIENT") throw forbidden("Cette action est réservée aux clients.");
  return actor;
}

export async function requireLender(permission?: string): Promise<Actor & { lenderId: string }> {
  const actor = await requireActor();
  if (actor.accountType !== "LENDER" || !actor.lenderId) throw forbidden("Cette action est réservée aux loueurs.");
  if (permission && !can(actor, permission)) throw forbidden("Votre rôle ne permet pas cette action.");
  return actor as Actor & { lenderId: string };
}

export async function requireAdmin(permission?: string): Promise<Actor> {
  const actor = await requireActor();
  if (actor.accountType !== "ADMIN") throw forbidden("Cette action est réservée à l'administration.");
  if (permission && !can(actor, permission)) throw forbidden("Votre rôle ne permet pas cette action.");
  return actor;
}

/** Un client, un loueur ou un administrateur peuvent consulter une réservation selon leur périmètre. */
export function assertLenderApproved(actor: Actor): void {
  if (actor.lenderStatus !== "APPROVED") {
    throw new AppError("FORBIDDEN", "Votre entreprise doit être validée par LOC'CONNECT pour effectuer cette action.");
  }
}
