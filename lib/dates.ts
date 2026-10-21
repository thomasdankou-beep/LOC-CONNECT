/**
 * Les dates de location sont des jours calendaires UTC. Une période est l'intervalle semi-ouvert [début, fin).
 * Règle de chevauchement du cahier des charges : début demandé < fin existante ET fin demandée > début existant.
 */
const MS_DAY = 86_400_000;
export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function parseDate(value: string): Date {
  if (!ISO_DATE.test(value)) throw new Error(`Date invalide: ${value}`);
  const d = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value) throw new Error(`Date invalide: ${value}`);
  return d;
}

export function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function todayUTC(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * MS_DAY);
}

export function addHours(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 3_600_000);
}

export function addMinutes(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 60_000);
}

/** Nombre de jours facturés entre début (inclus) et fin (exclu). */
export function daysBetween(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / MS_DAY);
}

export function eachDay(start: Date, end: Date): Date[] {
  const out: Date[] = [];
  for (let d = start; d < end; d = addDays(d, 1)) out.push(d);
  return out;
}

export function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && aEnd > bStart;
}

export function hoursUntil(target: Date, now: Date = new Date()): number {
  return (target.getTime() - now.getTime()) / 3_600_000;
}

const FR_DATE = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
const FR_DATE_TIME = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

export const formatDate = (d: Date | string) => FR_DATE.format(typeof d === "string" ? new Date(d) : d);
export const formatDateTime = (d: Date | string) => FR_DATE_TIME.format(typeof d === "string" ? new Date(d) : d);
