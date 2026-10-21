import { PrismaClient, Prisma } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.PRISMA_LOG === "1" ? ["query", "warn", "error"] : ["warn", "error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

export type Tx = Prisma.TransactionClient;
export type DbOrTx = PrismaClient | Prisma.TransactionClient;

/** Transaction sérialisable pour les opérations critiques (stock, finance). */
export function transaction<T>(fn: (tx: Tx) => Promise<T>, opts?: { timeout?: number }): Promise<T> {
  return db.$transaction(fn, {
    maxWait: 10_000,
    timeout: opts?.timeout ?? 20_000,
    isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
  });
}

/** Verrou de ligne sur des produits : sérialise toute opération qui modifie leur disponibilité. */
export async function lockProducts(tx: Tx, productIds: string[]): Promise<void> {
  if (productIds.length === 0) return;
  const ids = [...new Set(productIds)].sort();
  await tx.$queryRaw`SELECT id FROM "Product" WHERE id = ANY(${ids}::text[]) ORDER BY id FOR UPDATE`;
}

/** Verrou de ligne sur un paiement (idempotence des webhooks). */
export async function lockPayment(tx: Tx, paymentId: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM "Payment" WHERE id = ${paymentId} FOR UPDATE`;
}

/** Verrou de ligne sur une réservation. */
export async function lockReservation(tx: Tx, reservationId: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM "Reservation" WHERE id = ${reservationId} FOR UPDATE`;
}
