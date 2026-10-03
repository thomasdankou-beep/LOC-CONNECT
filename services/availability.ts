import type { ReservationStatus } from "@prisma/client";
import { db, lockProducts, type DbOrTx, type Tx } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { addDays, daysBetween, eachDay, toISODate, todayUTC, addHours } from "@/lib/dates";
import { getSettings, type Settings } from "@/lib/settings";
import { OCCUPYING_STATUSES } from "@/lib/state-machine";

export type DayAvailability = {
  date: string;
  stock: number;
  reserved: number;
  held: number;
  blocked: number;
  lenderBlocked: boolean;
  /** Quantité réellement réservable ce jour-là (0 si le loueur est indisponible). */
  available: number;
};

export type AvailabilityOptions = {
  /** Ignore ce HOLD (le client re-vérifie son propre blocage). */
  excludeHoldId?: string;
  /** Ignore ces lignes de réservation (modification d'une réservation existante). */
  excludeItemIds?: string[];
  now?: Date;
};

/**
 * Disponibilité jour par jour, pour plusieurs produits à la fois.
 * stock_disponible = stock_physique - indisponible - réservé - HOLD actifs (cahier des charges 16 BIS).
 * Période semi-ouverte [start, end). Un HOLD expiré ne compte jamais, même si le nettoyage n'est pas encore passé.
 */
export async function availabilityForProducts(
  client: DbOrTx,
  productIds: string[],
  start: Date,
  end: Date,
  opts: AvailabilityOptions = {},
): Promise<Map<string, DayAvailability[]>> {
  const now = opts.now ?? new Date();
  const result = new Map<string, DayAvailability[]>();
  if (productIds.length === 0 || end <= start) return result;

  const days = eachDay(start, end);
  const index = (d: Date) => daysBetween(start, d);

  const [products, items, holds, blocks, unavailabilities] = await Promise.all([
    client.product.findMany({ where: { id: { in: productIds } }, select: { id: true, stockQuantity: true, lenderId: true } }),
    client.reservationItem.findMany({
      where: {
        productId: { in: productIds },
        status: { in: OCCUPYING_STATUSES },
        startDate: { lt: end },
        endDate: { gt: start },
        ...(opts.excludeItemIds?.length ? { id: { notIn: opts.excludeItemIds } } : {}),
      },
      select: { productId: true, quantity: true, startDate: true, endDate: true },
    }),
    client.holdItem.findMany({
      where: {
        productId: { in: productIds },
        startDate: { lt: end },
        endDate: { gt: start },
        hold: { status: "ACTIVE", expiresAt: { gt: now }, ...(opts.excludeHoldId ? { id: { not: opts.excludeHoldId } } : {}) },
      },
      select: { productId: true, quantity: true, startDate: true, endDate: true },
    }),
    client.availabilityBlock.findMany({
      where: { productId: { in: productIds }, startDate: { lt: end }, endDate: { gt: start } },
      select: { productId: true, quantity: true, startDate: true, endDate: true },
    }),
    client.lenderUnavailability.findMany({
      where: { active: true, startDate: { lt: end }, endDate: { gt: start }, lender: { products: { some: { id: { in: productIds } } } } },
      select: { lenderId: true, startDate: true, endDate: true },
    }),
  ]);

  const spread = (rows: { productId: string; quantity: number; startDate: Date; endDate: Date }[]) => {
    const map = new Map<string, number[]>();
    for (const r of rows) {
      const arr = map.get(r.productId) ?? new Array<number>(days.length).fill(0);
      const from = Math.max(0, index(r.startDate));
      const to = Math.min(days.length, index(r.endDate));
      for (let i = from; i < to; i++) arr[i] += r.quantity;
      map.set(r.productId, arr);
    }
    return map;
  };
  const reservedMap = spread(items);
  const heldMap = spread(holds);
  const blockedMap = spread(blocks);

  for (const p of products) {
    const reserved = reservedMap.get(p.id);
    const held = heldMap.get(p.id);
    const blocked = blockedMap.get(p.id);
    const lenderOff = new Array<boolean>(days.length).fill(false);
    for (const u of unavailabilities) {
      if (u.lenderId !== p.lenderId) continue;
      const from = Math.max(0, index(u.startDate));
      const to = Math.min(days.length, index(u.endDate));
      for (let i = from; i < to; i++) lenderOff[i] = true;
    }
    result.set(
      p.id,
      days.map((d, i) => {
        const r = reserved?.[i] ?? 0;
        const h = held?.[i] ?? 0;
        const b = blocked?.[i] ?? 0;
        const free = Math.max(0, p.stockQuantity - r - h - b);
        return { date: toISODate(d), stock: p.stockQuantity, reserved: r, held: h, blocked: b, lenderBlocked: lenderOff[i], available: lenderOff[i] ? 0 : free };
      }),
    );
  }
  return result;
}

export async function availabilityForProduct(client: DbOrTx, productId: string, start: Date, end: Date, opts?: AvailabilityOptions) {
  return (await availabilityForProducts(client, [productId], start, end, opts)).get(productId) ?? [];
}

export const minAvailable = (days: DayAvailability[]): number => (days.length ? Math.min(...days.map((d) => d.available)) : 0);

export type RentalLineRequest = { productId: string; quantity: number; start: Date; end: Date };

/** Règles de période : date_debut < date_fin, quantité > 0, délai minimal, durée min et max. */
export function validateRentalPeriod(
  settings: Settings,
  product: { minDays: number; maxDays: number | null; name: string },
  line: { quantity: number; start: Date; end: Date },
  now: Date = new Date(),
): void {
  if (!Number.isInteger(line.quantity) || line.quantity <= 0) throw new AppError("VALIDATION_ERROR", "La quantité doit être supérieure à zéro.");
  if (!(line.start < line.end)) throw new AppError("VALIDATION_ERROR", "La date de début doit précéder la date de fin.");
  const lead = settings["booking.min_lead_hours"];
  const earliest = todayUTC(addHours(now, lead));
  if (line.start < todayUTC(now)) throw new AppError("VALIDATION_ERROR", "La date de début ne peut pas être dans le passé.");
  if (line.start < earliest) throw new AppError("VALIDATION_ERROR", `La réservation doit être faite au moins ${lead} h avant le début.`);
  const days = daysBetween(line.start, line.end);
  const max = Math.min(settings["booking.max_days"], product.maxDays ?? Number.MAX_SAFE_INTEGER);
  if (days > max) throw new AppError("VALIDATION_ERROR", `${product.name} : durée maximale de ${max} jours.`);
  if (days < product.minDays) throw new AppError("VALIDATION_ERROR", `${product.name} : durée minimale de ${product.minDays} jour(s).`);
}

/**
 * Contrôle de disponibilité à l'intérieur d'une transaction. Verrouille d'abord les lignes produit
 * (SELECT ... FOR UPDATE) pour sérialiser les réservations concurrentes, puis recalcule depuis la base.
 */
export async function assertAvailable(tx: Tx, lines: RentalLineRequest[], opts: AvailabilityOptions = {}): Promise<void> {
  const productIds = [...new Set(lines.map((l) => l.productId))];
  await lockProducts(tx, productIds);

  for (const productId of productIds) {
    const mine = lines.filter((l) => l.productId === productId);
    const from = new Date(Math.min(...mine.map((l) => l.start.getTime())));
    const to = new Date(Math.max(...mine.map((l) => l.end.getTime())));
    const avail = await availabilityForProduct(tx, productId, from, to, opts);
    const requested = new Map<string, number>();
    for (const l of mine) for (const d of eachDay(l.start, l.end)) requested.set(toISODate(d), (requested.get(toISODate(d)) ?? 0) + l.quantity);
    for (const day of avail) {
      const want = requested.get(day.date) ?? 0;
      if (want > day.available) {
        const reason = day.lenderBlocked ? "Le loueur est indisponible à cette date." : `Stock insuffisant le ${day.date} (disponible : ${day.available}).`;
        throw new AppError("STOCK_INSUFFICIENT", reason, { productId, date: day.date, available: day.available, requested: want });
      }
    }
  }
}

export async function loadSettingsForBooking(client: DbOrTx = db) {
  return getSettings(client);
}

export type { ReservationStatus };
export { addDays };
