"use client";

import { useId, useState } from "react";
import { cn } from "@/lib/cn";
import { formatFcfa } from "@/lib/money";

export type Series = { key: string; label: string };
export type BarDatum = { label: string; values: Record<string, number> };

/**
 * Histogramme SVG (colonnes, une ou plusieurs séries empilées).
 * Marques : 24 px d'épaisseur maximum, extrémité arrondie de 4 px, base droite, 2 px d'écart entre segments.
 * Une série : pas de légende. Plusieurs séries : légende toujours présente. Valeurs au survol et au focus clavier,
 * et vue tableau pour ne rien réserver à la souris.
 */
/** `unit` est une chaîne (et non une fonction) pour pouvoir être fourni par un composant serveur. */
export function BarChart({ data, series, unit = "number", height = 220, ariaLabel }: { data: BarDatum[]; series: Series[]; unit?: "fcfa" | "number"; height?: number; ariaLabel: string }) {
  const format = (n: number) => (unit === "fcfa" ? formatFcfa(n) : new Intl.NumberFormat("fr-FR").format(n));
  const id = useId();
  const [active, setActive] = useState<number | null>(null);
  const width = 640;
  const pad = { l: 56, r: 12, t: 12, b: 28 };
  const innerW = width - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;
  const totals = data.map((d) => series.reduce((a, s) => a + (d.values[s.key] ?? 0), 0));
  const rawMax = Math.max(...totals, 1);
  const step = niceStep(rawMax / 4);
  const max = Math.ceil(rawMax / step) * step;
  const ticks = Array.from({ length: Math.round(max / step) + 1 }, (_, i) => i * step);
  const band = innerW / Math.max(data.length, 1);
  const barW = Math.min(24, band * 0.6);
  const y = (v: number) => pad.t + innerH - (v / max) * innerH;
  const shade = (i: number) => (i === 0 ? "var(--lc-royal)" : `color-mix(in srgb, var(--lc-royal) ${Math.max(22, 55 - i * 18)}%, var(--lc-surface))`);
  const compact = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0)} M` : n >= 1000 ? `${Math.round(n / 1000)} k` : String(n));

  return (
    <figure className="w-full">
      {series.length > 1 && (
        <figcaption className="mb-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink">
          {series.map((s, i) => (
            <span key={s.key} className="inline-flex items-center gap-2">
              <span className="inline-block size-3 rounded-[3px]" style={{ background: shade(i) }} aria-hidden />
              {s.label}
            </span>
          ))}
        </figcaption>
      )}
      <div className="relative">
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={ariaLabel} className="w-full" onMouseLeave={() => setActive(null)}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={width - pad.r} y1={y(t)} y2={y(t)} stroke="var(--lc-line)" strokeWidth={1} />
              <text x={pad.l - 8} y={y(t)} textAnchor="end" dominantBaseline="middle" fontSize={11} fill="var(--lc-muted)" className="tabular-nums">
                {compact(t)}
              </text>
            </g>
          ))}
          {data.map((d, i) => {
            const cx = pad.l + band * i + band / 2;
            let acc = 0;
            return (
              <g key={d.label} onMouseEnter={() => setActive(i)} onFocus={() => setActive(i)} onBlur={() => setActive(null)} tabIndex={0} role="listitem" aria-label={`${d.label} : ${series.map((s) => `${s.label} ${format(d.values[s.key] ?? 0)}`).join(", ")}`} className="outline-none focus-visible:[&>rect.hit]:stroke-[var(--lc-royal)]" opacity={active === null || active === i ? 1 : 0.55}>
                <rect className="hit" x={pad.l + band * i} y={pad.t} width={band} height={innerH} fill="transparent" stroke="transparent" strokeWidth={2} rx={4} />
                {series.map((s, si) => {
                  const v = d.values[s.key] ?? 0;
                  if (v <= 0) return null;
                  const h = Math.max(2, (v / max) * innerH - (si > 0 ? 2 : 0));
                  const top = y(acc + v);
                  const topSegment = si === series.length - 1 || series.slice(si + 1).every((n) => (d.values[n.key] ?? 0) <= 0);
                  acc += v;
                  const x = cx - barW / 2;
                  const r = topSegment ? Math.min(4, h) : 0;
                  const path = `M${x},${top + h} L${x},${top + r} Q${x},${top} ${x + r},${top} L${x + barW - r},${top} Q${x + barW},${top} ${x + barW},${top + r} L${x + barW},${top + h} Z`;
                  return <path key={s.key} d={path} fill={shade(si)} />;
                })}
                <text x={cx} y={height - 8} textAnchor="middle" fontSize={11} fill="var(--lc-muted)">
                  {d.label}
                </text>
              </g>
            );
          })}
        </svg>
        {active !== null && data[active] && (
          <div className="pointer-events-none absolute top-2 z-10 min-w-36 rounded-control border border-line bg-surface px-3 py-2 text-sm shadow-card" style={{ left: `clamp(0px, calc(${((pad.l + band * active + band / 2) / width) * 100}% - 4.5rem), calc(100% - 9.5rem))` }}>
            <p className="text-xs text-muted">{data[active].label}</p>
            {series.map((s, i) => (
              <p key={s.key} className="mt-0.5 flex items-center justify-between gap-3">
                <span className="flex items-center gap-1.5 text-xs text-muted">
                  <span className="inline-block h-0.5 w-3" style={{ background: shade(i) }} aria-hidden />
                  {s.label}
                </span>
                <span className="font-semibold tabular-nums text-ink">{format(data[active].values[s.key] ?? 0)}</span>
              </p>
            ))}
          </div>
        )}
      </div>
      <details className="mt-2 text-sm">
        <summary className="inline-flex cursor-pointer items-center text-royal-ink hover:underline">Voir les données en tableau</summary>
        <table className="mt-2 w-full text-left text-sm" aria-describedby={id}>
          <caption id={id} className="sr-only">{ariaLabel}</caption>
          <thead>
            <tr className="text-xs text-muted">
              <th className="py-1 pr-3 font-medium">Période</th>
              {series.map((s) => (
                <th key={s.key} className="py-1 pr-3 text-right font-medium">{s.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.label} className="border-t border-line">
                <th scope="row" className="py-1 pr-3 text-left font-normal text-ink">{d.label}</th>
                {series.map((s) => (
                  <td key={s.key} className={cn("py-1 pr-3 text-right tabular-nums text-ink")}>{format(d.values[s.key] ?? 0)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

function niceStep(raw: number): number {
  const exp = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1))));
  const f = raw / exp;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  return nice * exp;
}
