import { db, type DbOrTx } from "./db";
import type { Prisma } from "@prisma/client";

export type RequestMeta = { ip?: string | null; userAgent?: string | null };

export type AuditInput = {
  userId?: string | null;
  lenderId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  meta?: RequestMeta;
};

const json = (v: unknown): Prisma.InputJsonValue | undefined =>
  v === undefined || v === null ? undefined : (JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue);

/** Journal d'audit des actions sensibles. Toujours appelé dans la même transaction que l'action auditée. */
export async function audit(client: DbOrTx, input: AuditInput): Promise<void> {
  await client.auditLog.create({
    data: {
      userId: input.userId ?? null,
      lenderId: input.lenderId ?? null,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId ?? null,
      oldValue: json(input.oldValue),
      newValue: json(input.newValue),
      ip: input.meta?.ip ?? null,
      userAgent: input.meta?.userAgent?.slice(0, 300) ?? null,
    },
  });
}

export const auditStandalone = (input: AuditInput) => audit(db, input);
