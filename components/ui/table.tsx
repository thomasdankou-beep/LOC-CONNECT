import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { EmptyState } from "./states";

export type Column<T> = { header: string; cell: (row: T) => ReactNode; className?: string; align?: "left" | "right" };

/** Tableau de données. Sur mobile, défilement horizontal contenu (jamais de défilement de page). */
export function DataTable<T>({ columns, rows, rowKey, empty }: { columns: Column<T>[]; rows: T[]; rowKey: (row: T) => string; empty?: { title: string; description?: string; action?: ReactNode } }) {
  if (rows.length === 0) return <EmptyState title={empty?.title ?? "Aucun résultat"} description={empty?.description} action={empty?.action} />;
  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-line bg-surface-2/60">
              {columns.map((c) => (
                <th key={c.header} scope="col" className={cn("whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted", c.align === "right" && "text-right", c.className)}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((row) => (
              <tr key={rowKey(row)} className="transition hover:bg-surface-2/40">
                {columns.map((c) => (
                  <td key={c.header} className={cn("px-4 py-3 align-middle text-ink", c.align === "right" && "text-right tabular-nums", c.className)}>
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
