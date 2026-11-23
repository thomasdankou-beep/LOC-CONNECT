"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { api } from "@/lib/api-client";
import { addDays, daysBetween, parseDate, toISODate, todayUTC } from "@/lib/dates";
import { CaretLeft, CaretRight } from "@/components/ui/icons";
import { cn } from "@/lib/cn";

export type DayInfo = { date: string; stock: number; available: number; lenderBlocked: boolean };

const WEEKDAYS = ["L", "M", "M", "J", "V", "S", "D"];
const MONTH_FMT = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" });
const LONG_FMT = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

const monthStart = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
const addMonths = (d: Date, n: number) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));

type Props = {
  productId: string;
  start: string | null;
  end: string | null;
  onChange: (start: string | null, end: string | null) => void;
  onAvailability?: (map: Record<string, DayInfo>) => void;
  minDays?: number;
  maxDays?: number | null;
  returnBufferDays?: number;
  months?: 1 | 2;
};

/**
 * Calendrier de sélection d'une période de location. La disponibilité jour par jour vient du serveur
 * (stock moins réservations, HOLD actifs et indisponibilités du loueur). La date de fin envoyée au panier est exclusive.
 */
export function RangeCalendar({ productId, start, end, onChange, onAvailability, minDays = 1, maxDays = null, returnBufferDays = 1, months = 2 }: Props) {
  const modeId = useId();
  const [mode, setMode] = useState<"single" | "range">(() =>
    minDays > 1 || (start && end && daysBetween(parseDate(start), parseDate(end)) > 1) ? "range" : "single",
  );
  const today = useMemo(() => todayUTC(), []);
  const [view, setView] = useState(() => monthStart(start ? new Date(`${start}T00:00:00Z`) : today));
  const [days, setDays] = useState<Record<string, DayInfo>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [hover, setHover] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    const from = view;
    const to = addDays(addMonths(view, months), returnBufferDays);
    api<DayInfo[]>(`/api/products/${productId}/availability?start=${toISODate(from)}&end=${toISODate(to)}`)
      .then((rows) => {
        if (cancelled) return;
        setDays((prev) => {
          const next = { ...prev };
          for (const r of rows) next[r.date] = r;
          return next;
        });
      })
      .catch(() => !cancelled && setError(true))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, view, months, returnBufferDays]);

  useEffect(() => {
    onAvailability?.(days);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

  const todayIso = toISODate(today);
  const free = (iso: string) => (days[iso]?.available ?? 1) > 0;

  function allFree(from: string, to: string) {
    const until = addDays(new Date(`${to}T00:00:00Z`), returnBufferDays);
    for (let d = new Date(`${from}T00:00:00Z`); d < until; d = addDays(d, 1)) if (!free(toISODate(d))) return false;
    return true;
  }

  function changeMode(next: "single" | "range") {
    setMode(next);
    setHover(null);
    onChange(null, null);
  }

  function canEndOn(iso: string) {
    if (!start || iso <= start) return false;
    const exclusiveEnd = addDays(parseDate(iso), 1);
    return daysBetween(parseDate(start), exclusiveEnd) >= Math.max(2, minDays) && allFree(start, toISODate(exclusiveEnd));
  }

  function pick(iso: string) {
    if (iso < todayIso || !free(iso)) return;
    if (mode === "single") {
      const exclusiveEnd = toISODate(addDays(parseDate(iso), 1));
      if (allFree(iso, exclusiveEnd)) onChange(iso, exclusiveEnd);
      return;
    }
    if (!start || end || iso <= start || !allFree(start, toISODate(addDays(parseDate(iso), 1)))) {
      onChange(iso, null);
      return;
    }
    if (canEndOn(iso)) onChange(start, toISODate(addDays(parseDate(iso), 1)));
  }

  const lastDay = end ? toISODate(addDays(parseDate(end), -1)) : null;
  const rangeEnd = lastDay ?? (mode === "range" && hover && canEndOn(hover) ? hover : null);

  const monthsList = Array.from({ length: months }, (_, i) => addMonths(view, i));

  return (
    <div>
      <fieldset className="mb-4">
        <legend className="mb-2 text-sm font-medium text-ink">Durée de location</legend>
        <div className="flex flex-wrap gap-2">
          <label className="flex items-center gap-2 rounded-control border border-line px-3 py-2 text-sm has-[:checked]:border-royal has-[:disabled]:opacity-50">
            <input type="radio" name={modeId} checked={mode === "single"} disabled={minDays > 1} onChange={() => changeMode("single")} />
            Une journée
          </label>
          <label className="flex items-center gap-2 rounded-control border border-line px-3 py-2 text-sm has-[:checked]:border-royal has-[:disabled]:opacity-50">
            <input type="radio" name={modeId} checked={mode === "range"} disabled={maxDays === 1} onChange={() => changeMode("range")} />
            Plusieurs jours
          </label>
        </div>
        {minDays > 1 && <p className="mt-2 text-xs text-muted">Location de {minDays} jours minimum.</p>}
      </fieldset>
      <div className="mb-3 flex items-center justify-between">
        <button type="button" onClick={() => setView(addMonths(view, -1))} disabled={view <= monthStart(today)} className="flex size-10 items-center justify-center rounded-control border border-line bg-surface hover:bg-surface-2 disabled:opacity-40" aria-label="Mois précédent">
          <CaretLeft size={18} />
        </button>
        <p className="text-sm text-muted" aria-live="polite">
          {end ? "Dates sélectionnées" : mode === "single" ? "Choisissez le jour de location" : start ? "Choisissez le dernier jour de location" : "Choisissez le premier jour de location"}
        </p>
        <button type="button" onClick={() => setView(addMonths(view, 1))} className="flex size-10 items-center justify-center rounded-control border border-line bg-surface hover:bg-surface-2" aria-label="Mois suivant">
          <CaretRight size={18} />
        </button>
      </div>

      <div className={cn("grid gap-6", months === 2 && "md:grid-cols-2")} onMouseLeave={() => setHover(null)}>
        {monthsList.map((m) => {
          const first = m;
          const offset = (first.getUTCDay() + 6) % 7;
          const count = new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth() + 1, 0)).getUTCDate();
          return (
            <div key={toISODate(m)} aria-busy={loading}>
              <h3 className="mb-2 text-center text-sm font-semibold capitalize text-ink">{MONTH_FMT.format(m)}</h3>
              <div className="grid grid-cols-7 gap-y-1 text-center">
                {WEEKDAYS.map((w, i) => (
                  <span key={i} className="pb-1 text-xs font-medium text-muted" aria-hidden>
                    {w}
                  </span>
                ))}
                {Array.from({ length: offset }, (_, i) => (
                  <span key={`b${i}`} />
                ))}
                {Array.from({ length: count }, (_, i) => {
                  const d = new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth(), i + 1));
                  const iso = toISODate(d);
                  const past = iso < todayIso;
                  const info = days[iso];
                  const unavailable = !past && (mode === "single"
                    ? !allFree(iso, toISODate(addDays(d, 1)))
                    : !free(iso));
                  const isStart = iso === start;
                  const isEnd = iso === lastDay;
                  const inRange = start && rangeEnd ? iso > start && iso <= rangeEnd && !isEnd : false;
                  const disabled = past || unavailable;
                  return (
                    <button
                      key={iso}
                      type="button"
                      disabled={disabled}
                      onClick={() => pick(iso)}
                      onMouseEnter={() => setHover(iso)}
                      aria-pressed={isStart || isEnd}
                      aria-label={`${LONG_FMT.format(d)}${unavailable ? ", indisponible" : info ? `, ${info.available} disponible${info.available > 1 ? "s" : ""}` : ""}`}
                      className={cn(
                        "relative mx-auto flex size-10 items-center justify-center text-sm transition",
                        isStart || isEnd ? "z-10 rounded-control bg-royal font-semibold text-white" : inRange ? "bg-royal-soft text-royal-ink" : "rounded-control text-ink hover:bg-surface-2",
                        inRange && "w-full rounded-none",
                        (past || unavailable) && "cursor-not-allowed text-muted/50 line-through",
                        unavailable && !past && "bg-surface-2/60",
                      )}
                    >
                      {i + 1}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      {error && <p role="alert" className="mt-3 text-sm text-danger">La disponibilité n&apos;a pas pu être chargée. Elle sera vérifiée au moment de la réservation.</p>}
      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted">
        <span className="flex items-center gap-1.5"><span className="inline-block size-3 rounded-sm bg-royal" /> Jour choisi ou bornes de la période</span>
        <span className="flex items-center gap-1.5"><span className="inline-block size-3 rounded-sm bg-royal-soft" /> Jours entre les deux dates</span>
        <span className="flex items-center gap-1.5"><span className="inline-block size-3 rounded-sm bg-surface-2" /> <span className="line-through">Indisponible</span></span>
      </div>
    </div>
  );
}
